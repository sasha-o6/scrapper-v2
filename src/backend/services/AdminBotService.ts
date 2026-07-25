import { md } from '@mtcute/markdown-parser'

import type {
  BotApiClient,
  IBotApiCallbackQuery,
  IBotApiMessage,
  IBotApiReplyMarkup,
  IBotApiUpdate
} from '@backend/services/BotApiClient'
import type { ClientManager, IAdminAuthResult } from '@backend/services/ClientManager'
import type { AdminLoginWebService } from '@backend/services/AdminLoginWebService'
import {
  appendBanPromptBlock,
  formatBanPromptBlock,
  type TBanPromptState
} from '@backend/services/Formatter'
import {
  BAN_DEEP_LINK_PREFIX,
  buildBanKeyboard,
  buildUnbanKeyboard,
  parseBanCallbackData,
  type SenderBanService,
  type TQueueItemWithOwner
} from '@backend/services/SenderBanService'
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
    private readonly pollingIntervalMs: number,
    private readonly senderBanService: SenderBanService | null = null
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
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query)

      return
    }

    const message = update.message

    if (!message?.text || !message.from) {
      return
    }

    const text = message.text.trim()

    if (text.startsWith(BAN_DEEP_LINK_PREFIX)) {
      await this.handleBanDeepLink(text, message)

      return
    }

    if (BigInt(message.from.id) !== this.adminTelegramId) {
      return
    }

    await this.handleAdminText(text)
  }

  private async handleCallbackQuery(callbackQuery: IBotApiCallbackQuery): Promise<void> {
    if (!this.senderBanService || !callbackQuery.data) {
      return
    }

    const action = parseBanCallbackData(callbackQuery.data)

    if (!action) {
      return
    }

    const resolved = await this.senderBanService.resolveQueueItemForRequester(
      action.queueItemId,
      BigInt(callbackQuery.from.id)
    )

    if (!resolved.ok) {
      await this.botApiClient.answerCallbackQuery(callbackQuery.id, resolved.reason)

      return
    }

    if (action.type === 'ban') {
      await this.senderBanService.banQueueItemSender(resolved.item)
      await this.botApiClient.answerCallbackQuery(callbackQuery.id, 'Користувача заблоковано')
      await this.updateCallbackKeyboard(callbackQuery, buildUnbanKeyboard(action.queueItemId))

      return
    }

    await this.senderBanService.unbanQueueItemSender(resolved.item)
    await this.botApiClient.answerCallbackQuery(callbackQuery.id, 'Користувача розблоковано')
    await this.updateCallbackKeyboard(callbackQuery, buildBanKeyboard(action.queueItemId))
  }

  private async updateCallbackKeyboard(
    callbackQuery: IBotApiCallbackQuery,
    replyMarkup: IBotApiReplyMarkup
  ): Promise<void> {
    if (!callbackQuery.message) {
      return
    }

    try {
      await this.botApiClient.editMessageReplyMarkup(
        callbackQuery.message.chat.id,
        callbackQuery.message.message_id,
        replyMarkup
      )
    } catch (error) {
      logger.warn('Failed to toggle ban keyboard', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  private async handleBanDeepLink(text: string, message: IBotApiMessage): Promise<void> {
    if (!this.senderBanService || !message.from) {
      return
    }

    const queueItemId = text.slice(BAN_DEEP_LINK_PREFIX.length).trim()
    const chatId = message.chat.id.toString()
    const resolved = await this.senderBanService.resolveQueueItemForRequester(
      queueItemId,
      BigInt(message.from.id)
    )

    if (!resolved.ok) {
      await this.botApiClient.sendMessage(chatId, resolved.reason)

      return
    }

    await this.editUserbotBanPrompt(resolved.item, 'banning')
    await this.senderBanService.banQueueItemSender(resolved.item)
    await this.editUserbotBanPrompt(resolved.item, 'banned')
    await this.botApiClient.sendMessage(chatId, '✅ Користувача заблоковано')
  }

  private async editUserbotBanPrompt(
    item: TQueueItemWithOwner,
    state: TBanPromptState
  ): Promise<void> {
    if (item.sentMessageId === null) {
      return
    }

    const text = appendBanPromptBlock(item.messageText, formatBanPromptBlock(state))

    await this.clientManager.editSystemMessageText(
      item.targetChat,
      Number(item.sentMessageId),
      md(text)
    )
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
