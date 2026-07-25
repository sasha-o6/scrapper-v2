import { md } from '@mtcute/markdown-parser'
import type { MessageQueue, PrismaClient, User } from '@prisma/client'

import type { IMtcuteRuntimeClient } from '@backend/services/ClientManager'
import type {
  IBotApiMessage,
  IBotApiReplyMarkup,
  IBotApiUser
} from '@backend/services/BotApiClient'
import {
  appendBanPromptBlock,
  buildBanDeepLink,
  formatBanPromptBlock
} from '@backend/services/Formatter'
import { buildBanKeyboard } from '@backend/services/SenderBanService'
import { logger } from '@backend/utils/logger'

interface IClientProvider {
  getSystemClient(): Promise<IMtcuteRuntimeClient | null>
}

interface IBotMessageSender {
  readonly tokenBotId?: string | null
  getMe(): Promise<IBotApiUser>
  sendMessage(
    chatId: string,
    text: string,
    replyMarkup?: IBotApiReplyMarkup
  ): Promise<IBotApiMessage | void>
}

type TQueuedMessageItem = MessageQueue & {
  user: Pick<User, 'telegramId'>
}

const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'])

const extractSentMessageId = (sentMessage: unknown): bigint | null => {
  if (typeof sentMessage !== 'object' || sentMessage === null) {
    return null
  }

  const id = (sentMessage as { id?: unknown }).id

  if (typeof id === 'number' && Number.isFinite(id)) {
    return BigInt(Math.trunc(id))
  }

  return null
}

const normalizeTargetRef = (value: string): string => {
  const trimmedValue = value.trim()

  try {
    const url = new URL(trimmedValue.startsWith('http') ? trimmedValue : `https://${trimmedValue}`)

    if (TELEGRAM_HOSTS.has(url.hostname.toLocaleLowerCase('en-US'))) {
      return url.pathname.replace(/^\/+|\/+$/g, '').split('/')[0]?.toLocaleLowerCase('en-US') ?? ''
    }
  } catch {
    // Fall through to plain username/id normalization.
  }

  return trimmedValue.replace(/^@/, '').toLocaleLowerCase('en-US')
}

export class MessageQueueWorker {
  private intervalId: ReturnType<typeof setInterval> | null = null

  private isTicking = false
  private botSelfRefs: Set<string> | null = null
  private botUsername: string | null | undefined = undefined

  public constructor(
    private readonly db: PrismaClient,
    private readonly clientProvider: IClientProvider,
    private readonly intervalMs: number,
    private readonly botMessageSender: IBotMessageSender | null = null
  ) {}

  public start(): void {
    if (this.intervalId) {
      return
    }

    this.intervalId = setInterval(() => {
      void this.tick().catch((error) => {
        logger.error('Queue worker tick failed', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
    }, this.intervalMs)
  }

  public stop(): void {
    if (!this.intervalId) {
      return
    }

    clearInterval(this.intervalId)
    this.intervalId = null
  }

  public async tick(): Promise<void> {
    if (this.isTicking) {
      return
    }

    this.isTicking = true

    try {
      const item = await this.getNextPendingItem()

      if (!item) {
        return
      }

      await this.sendItem(item)
    } finally {
      this.isTicking = false
    }
  }

  private async getNextPendingItem(): Promise<TQueuedMessageItem | null> {
    return this.db.messageQueue.findFirst({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            telegramId: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })
  }

  private async sendItem(item: TQueuedMessageItem): Promise<void> {
    if (await this.shouldSendToQueueOwnerViaBot(item.targetChat)) {
      await this.sendItemViaBot(item)

      return
    }

    const client = await this.clientProvider.getSystemClient()

    if (!client) {
      await this.markFailed(item.id, 'Central Telegram userbot is not authorized')

      return
    }

    try {
      const messageText = await this.buildUserbotMessageText(item)
      const sentMessage = await client.sendText(item.targetChat, md(messageText))
      await this.markSent(item.id, extractSentMessageId(sentMessage))
    } catch (error) {
      await this.markFailed(item.id, error instanceof Error ? error.message : String(error))
    }
  }

  private async sendItemViaBot(item: TQueuedMessageItem): Promise<void> {
    if (!this.botMessageSender) {
      await this.markFailed(item.id, 'Bot API sender is not available')

      return
    }

    try {
      const replyMarkup =
        item.senderTelegramId !== null ? buildBanKeyboard(item.id) : undefined
      const sentMessage = await this.botMessageSender.sendMessage(
        item.user.telegramId.toString(),
        item.messageText,
        replyMarkup
      )
      await this.markSent(
        item.id,
        sentMessage ? BigInt(sentMessage.message_id) : null
      )
    } catch (error) {
      await this.markFailed(item.id, error instanceof Error ? error.message : String(error))
    }
  }

  private async buildUserbotMessageText(item: TQueuedMessageItem): Promise<string> {
    if (item.senderTelegramId === null) {
      return item.messageText
    }

    const botUsername = await this.getBotUsername()

    if (!botUsername) {
      return item.messageText
    }

    return appendBanPromptBlock(
      item.messageText,
      formatBanPromptBlock('ban', buildBanDeepLink(botUsername, item.id))
    )
  }

  private async getBotUsername(): Promise<string | null> {
    if (!this.botMessageSender) {
      return null
    }

    if (this.botUsername !== undefined) {
      return this.botUsername
    }

    try {
      const bot = await this.botMessageSender.getMe()
      this.botUsername = bot.username ?? null
    } catch {
      return null
    }

    return this.botUsername
  }

  private async shouldSendToQueueOwnerViaBot(targetChat: string): Promise<boolean> {
    if (!this.botMessageSender) {
      return false
    }

    const targetRef = normalizeTargetRef(targetChat)

    if (!targetRef) {
      return false
    }

    const botSelfRefs = await this.getBotSelfRefs()

    return botSelfRefs.has(targetRef)
  }

  private async getBotSelfRefs(): Promise<Set<string>> {
    if (this.botSelfRefs) {
      return this.botSelfRefs
    }

    const refs = new Set<string>()

    if (this.botMessageSender?.tokenBotId) {
      refs.add(normalizeTargetRef(this.botMessageSender.tokenBotId))
    }

    if (this.botMessageSender) {
      const bot = await this.botMessageSender.getMe()

      refs.add(bot.id.toString())

      if (bot.username) {
        refs.add(normalizeTargetRef(bot.username))
      }
    }

    this.botSelfRefs = refs

    return refs
  }

  private async markSent(id: string, sentMessageId: bigint | null = null): Promise<void> {
    await this.db.messageQueue.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        error: null,
        sentMessageId
      }
    })
  }

  private async markFailed(id: string, error: string): Promise<void> {
    await this.db.messageQueue.update({
      where: { id },
      data: {
        status: 'FAILED',
        error
      }
    })
  }
}
