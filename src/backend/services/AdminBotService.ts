import type { BotApiClient, IBotApiUpdate } from '@backend/services/BotApiClient'
import type { ClientManager, IAdminAuthResult } from '@backend/services/ClientManager'
import type { AdminLoginWebService } from '@backend/services/AdminLoginWebService'
import { logger } from '@backend/utils/logger'

export class AdminBotService {
  private intervalId: ReturnType<typeof setInterval> | null = null

  private isPolling = false

  private nextOffset = 0

  public constructor(
    private readonly botApiClient: BotApiClient,
    private readonly clientManager: ClientManager,
    private readonly adminLoginWebService: AdminLoginWebService,
    private readonly adminTelegramId: bigint,
    private readonly pollingIntervalMs: number
  ) {}

  public start(): void {
    if (this.intervalId) {
      return
    }

    void this.notifyLoggedOutIfNeeded().catch((error) => {
      logger.error('Admin bot login warning failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    })
    this.intervalId = setInterval(() => {
      void this.poll().catch((error) => {
        logger.error('Admin bot polling failed', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
    }, this.pollingIntervalMs)
  }

  public stop(): void {
    if (!this.intervalId) {
      return
    }

    clearInterval(this.intervalId)
    this.intervalId = null
  }

  public async poll(): Promise<void> {
    if (this.isPolling) {
      return
    }

    this.isPolling = true

    try {
      const updates = await this.botApiClient.getUpdates(this.nextOffset)

      for (const update of updates) {
        this.nextOffset = Math.max(this.nextOffset, update.update_id + 1)
        await this.handleUpdate(update)
      }
    } finally {
      this.isPolling = false
    }
  }

  private async notifyLoggedOutIfNeeded(): Promise<void> {
    if (await this.clientManager.isAuthorized()) {
      return
    }

    await this.sendToAdmin('⚠️ Userbot розлогінений. Надішли /login')
  }

  private async handleUpdate(update: IBotApiUpdate): Promise<void> {
    const message = update.message

    if (!message?.text || !message.from) {
      return
    }

    if (BigInt(message.from.id) !== this.adminTelegramId) {
      return
    }

    await this.handleAdminText(message.text.trim())
  }

  private async handleAdminText(text: string): Promise<void> {
    if (text === '/login') {
      const result = await this.clientManager.sendCodeToAdmin()
      await this.replyAuthResult(result)

      return
    }

    const authStatus = await this.clientManager.getAuthStatus()

    if (authStatus === 'CODE_SENT' || authStatus === 'PASSWORD_PENDING') {
      await this.sendToAdmin(
        'Не надсилай код або 2FA пароль у Telegram чат. Якщо вже надіслав код сюди, запроси новий через /login і введи його тільки на сторінці з посилання.'
      )

      return
    }

    if (!(await this.clientManager.isAuthorized())) {
      await this.sendToAdmin('⚠️ Userbot розлогінений. Надішли /login')
    }
  }

  private async replyAuthResult(result: IAdminAuthResult): Promise<void> {
    if (result.step === 'code') {
      const loginUrl = this.adminLoginWebService.issueLoginUrl()
      await this.sendToAdmin(
        `Код надіслано. Не надсилай його в Telegram чат.\nВведи код на сторінці: ${loginUrl}`
      )

      return
    }

    if (result.step === 'password') {
      const loginUrl = this.adminLoginWebService.issueLoginUrl()
      await this.sendToAdmin(
        `Потрібен 2FA пароль. Не надсилай його в Telegram чат.\nВведи пароль на сторінці: ${loginUrl}`
      )

      return
    }

    await this.sendToAdmin('✅ Userbot авторизовано. Dispatcher запущено.')
  }

  private async sendToAdmin(text: string): Promise<void> {
    await this.botApiClient.sendMessage(this.adminTelegramId.toString(), text)
  }
}
