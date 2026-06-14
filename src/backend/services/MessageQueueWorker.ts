import type { MessageQueue, PrismaClient } from '@prisma/client'

import type { IMtcuteRuntimeClient } from '@backend/services/ClientManager'
import { logger } from '@backend/utils/logger'

interface IClientProvider {
  getClientForUserId(userId: string): Promise<IMtcuteRuntimeClient | null>
}

export class MessageQueueWorker {
  private intervalId: ReturnType<typeof setInterval> | null = null

  private isTicking = false

  public constructor(
    private readonly db: PrismaClient,
    private readonly clientProvider: IClientProvider,
    private readonly intervalMs: number
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

  private async getNextPendingItem(): Promise<MessageQueue | null> {
    return this.db.messageQueue.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' }
    })
  }

  private async sendItem(item: MessageQueue): Promise<void> {
    const client = await this.clientProvider.getClientForUserId(item.userId)

    if (!client) {
      await this.markFailed(item.id, 'Telegram client is not authorized')

      return
    }

    try {
      await client.sendText(item.targetChat, item.messageText)
      await this.db.messageQueue.update({
        where: { id: item.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          error: null
        }
      })
    } catch (error) {
      await this.markFailed(item.id, error instanceof Error ? error.message : String(error))
    }
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
