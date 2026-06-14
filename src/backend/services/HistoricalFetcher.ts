import type { PrismaClient } from '@prisma/client'

import type { ClientManager, IMtcuteRuntimeClient } from '@backend/services/ClientManager'
import type { ScraperService } from '@backend/services/ScraperService'
import {
  type INormalizedTelegramMessage,
  normalizeTelegramMessage
} from '@backend/services/TelegramMessageNormalizer'
import { logger } from '@backend/utils/logger'

const HISTORY_BATCH_LIMIT = 50
const TELEGRAM_HISTORY_DELAY_MS = 2_000

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const getOldestMessageDate = (messages: INormalizedTelegramMessage[]): number | null => {
  if (messages.length === 0) {
    return null
  }

  return Math.min(...messages.map((message) => message.dateUnixSeconds))
}

export class HistoricalFetcher {
  public constructor(
    private readonly db: PrismaClient,
    private readonly clientManager: ClientManager,
    private readonly scraperService: ScraperService
  ) {}

  public async fetchForTelegramId(telegramId: bigint, days: number): Promise<number> {
    const user = await this.db.user.findUnique({ where: { telegramId } })

    if (!user) {
      throw new Error('User does not exist')
    }

    const config = await this.db.config.findUnique({ where: { userId: user.id } })

    if (!config) {
      return 0
    }

    const client = await this.clientManager.getClientForUserId(user.id)

    if (!client) {
      throw new Error('Telegram account is not authorized')
    }

    const cutoffSeconds = Math.floor(Date.now() / 1000) - Math.max(1, days) * 86_400
    let queued = 0

    for (const channel of config.channels) {
      queued += await this.fetchChannelHistory(user.id, client, channel, cutoffSeconds)
    }

    return queued
  }

  private async fetchChannelHistory(
    userId: string,
    client: IMtcuteRuntimeClient,
    channel: string,
    cutoffSeconds: number
  ): Promise<number> {
    let offsetDate = Math.floor(Date.now() / 1000)
    let queued = 0

    if (client.openChat) {
      await client.openChat(channel)
    }

    while (offsetDate > cutoffSeconds) {
      const rawMessages = await this.loadHistoryBatch(client, channel, offsetDate)
      const messages = rawMessages
        .map(normalizeTelegramMessage)
        .filter((message): message is INormalizedTelegramMessage => Boolean(message))
        .filter((message) => message.dateUnixSeconds >= cutoffSeconds)

      if (messages.length === 0) {
        break
      }

      for (const message of messages) {
        const wasQueued = await this.scraperService.processMessage(userId, message)

        if (wasQueued) {
          queued += 1
        }
      }

      const oldestDate = getOldestMessageDate(messages)

      if (!oldestDate || oldestDate >= offsetDate) {
        break
      }

      offsetDate = oldestDate - 1
      await sleep(TELEGRAM_HISTORY_DELAY_MS)
    }

    logger.info('Historical channel fetch completed', { userId, channel, queued })

    return queued
  }

  private async loadHistoryBatch(
    client: IMtcuteRuntimeClient,
    channel: string,
    offsetDate: number
  ): Promise<unknown[]> {
    if (!client.getHistory) {
      logger.warn('mtcute getHistory is unavailable in this runtime wrapper', { channel })

      return []
    }

    return client.getHistory(channel, {
      limit: HISTORY_BATCH_LIMIT,
      offset: {
        id: 0,
        date: offsetDate
      }
    })
  }
}
