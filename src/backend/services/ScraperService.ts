import { Prisma, type Config } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

import { isMessageFromConfiguredChannel } from '@backend/services/ChannelMatcher'
import { filterMessage } from '@backend/services/MessageFilter'
import {
  type INormalizedTelegramMessage,
  normalizeTelegramMessage
} from '@backend/services/TelegramMessageNormalizer'
import { formatForwardedMessage } from '@backend/services/Formatter'
import { logger } from '@backend/utils/logger'

export class ScraperService {
  public constructor(private readonly db: PrismaClient) {}

  public async handleIncomingMessage(rawMessage: unknown): Promise<number> {
    const message = normalizeTelegramMessage(rawMessage)

    if (!message) {
      return 0
    }

    return this.processRealtimeMessage(message)
  }

  public async processRealtimeMessage(message: INormalizedTelegramMessage): Promise<number> {
    const configs = await this.findSubscribedConfigs(message)
    let queued = 0

    for (const config of configs) {
      const wasQueued = await this.processMessageForConfig(config, message)

      if (wasQueued) {
        queued += 1
      }
    }

    return queued
  }

  public async processMessageForUser(
    userId: string,
    message: INormalizedTelegramMessage
  ): Promise<boolean> {
    const config = await this.db.config.findUnique({ where: { userId } })

    if (!config) {
      return false
    }

    return this.processMessageForConfig(config, message)
  }

  private async findSubscribedConfigs(
    message: INormalizedTelegramMessage
  ): Promise<Config[]> {
    const configs = await this.db.config.findMany({
      where: {
        isActive: true,
        targetChat: {
          not: null
        }
      }
    })

    return configs.filter((config) =>
      config.channels.some((channel) => isMessageFromConfiguredChannel(message, channel))
    )
  }

  private async processMessageForConfig(
    config: Config,
    message: INormalizedTelegramMessage
  ): Promise<boolean> {
    if (!config.isActive || !config.targetChat) {
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
      config.userId,
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
        userId: config.userId,
        messageText,
        targetChat: config.targetChat
      }
    })

    logger.info('Queued filtered Telegram message', {
      userId: config.userId,
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
