import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

import { filterMessage } from '@backend/services/MessageFilter'
import {
  type INormalizedTelegramMessage,
  normalizeTelegramMessage
} from '@backend/services/TelegramMessageNormalizer'
import { formatForwardedMessage } from '@backend/services/Formatter'
import { logger } from '@backend/utils/logger'

export class ScraperService {
  public constructor(private readonly db: PrismaClient) {}

  public async handleIncomingMessage(userId: string, rawMessage: unknown): Promise<boolean> {
    const message = normalizeTelegramMessage(rawMessage)

    if (!message) {
      return false
    }

    return this.processMessage(userId, message)
  }

  public async processMessage(
    userId: string,
    message: INormalizedTelegramMessage
  ): Promise<boolean> {
    const config = await this.db.config.findUnique({ where: { userId } })

    if (!config?.isActive || !config.targetChat) {
      return false
    }

    const filterResult = filterMessage(message.messageText, {
      keyWords: config.keyWords,
      strictMode: config.strictMode,
      additionalWords: config.additionalWords,
      banWords: config.banWords
    })

    if (!filterResult.accepted) {
      return false
    }

    const deduplicated = await this.markProcessed(
      userId,
      message.channelId,
      message.messageId
    )

    if (!deduplicated) {
      return false
    }

    const messageText = formatForwardedMessage({
      channelTitle: message.channelTitle,
      channel: message.channel,
      dateUnixSeconds: message.dateUnixSeconds,
      messageText: message.messageText,
      keyWords: [filterResult.matchedKeyWords, filterResult.matchedAdditionalWords],
      postLink: message.postLink
    })

    await this.db.messageQueue.create({
      data: {
        userId,
        messageText,
        targetChat: config.targetChat
      }
    })

    logger.info('Queued filtered Telegram message', {
      userId,
      channelId: message.channelId,
      messageId: message.messageId
    })

    return true
  }

  private async markProcessed(
    userId: string,
    channelId: string,
    messageId: string
  ): Promise<boolean> {
    try {
      await this.db.processedMessage.create({
        data: {
          userId,
          channelId,
          messageId
        }
      })

      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false
      }

      throw error
    }
  }
}
