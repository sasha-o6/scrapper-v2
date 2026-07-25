import type { MessageQueue, PrismaClient, User } from '@prisma/client'

import type { IBotApiReplyMarkup } from '@backend/services/BotApiClient'
import type { IBannedSenderDto } from '@shared/types'

export const BAN_CALLBACK_PREFIX = 'ban:'
export const UNBAN_CALLBACK_PREFIX = 'unban:'
export const BAN_DEEP_LINK_PREFIX = '/start ban_'

export const buildBanKeyboard = (queueItemId: string): IBotApiReplyMarkup => ({
  inline_keyboard: [
    [
      {
        text: '🚫 Заблокувати користувача',
        callback_data: `${BAN_CALLBACK_PREFIX}${queueItemId}`
      }
    ]
  ]
})

export const buildUnbanKeyboard = (queueItemId: string): IBotApiReplyMarkup => ({
  inline_keyboard: [
    [
      {
        text: '✅ Розблокувати користувача',
        callback_data: `${UNBAN_CALLBACK_PREFIX}${queueItemId}`
      }
    ]
  ]
})

export interface IBanCallbackAction {
  type: 'ban' | 'unban'
  queueItemId: string
}

export const parseBanCallbackData = (data: string): IBanCallbackAction | null => {
  if (data.startsWith(BAN_CALLBACK_PREFIX)) {
    return { type: 'ban', queueItemId: data.slice(BAN_CALLBACK_PREFIX.length) }
  }

  if (data.startsWith(UNBAN_CALLBACK_PREFIX)) {
    return { type: 'unban', queueItemId: data.slice(UNBAN_CALLBACK_PREFIX.length) }
  }

  return null
}

export type TQueueItemWithOwner = MessageQueue & {
  user: Pick<User, 'telegramId'>
}

export type TResolveQueueItemResult =
  | { ok: true; item: TQueueItemWithOwner }
  | { ok: false; reason: string }

export class SenderBanService {
  public constructor(private readonly db: PrismaClient) {}

  public async resolveQueueItemForRequester(
    queueItemId: string,
    requesterTelegramId: bigint
  ): Promise<TResolveQueueItemResult> {
    const item = await this.db.messageQueue.findUnique({
      where: { id: queueItemId },
      include: {
        user: {
          select: {
            telegramId: true
          }
        }
      }
    })

    if (!item) {
      return { ok: false, reason: 'Повідомлення не знайдено' }
    }

    if (item.user.telegramId !== requesterTelegramId) {
      return { ok: false, reason: 'Це повідомлення належить іншому користувачу' }
    }

    if (item.senderTelegramId === null) {
      return { ok: false, reason: 'Для цього повідомлення немає даних про відправника' }
    }

    return { ok: true, item }
  }

  public async banQueueItemSender(item: TQueueItemWithOwner): Promise<void> {
    if (item.senderTelegramId === null) {
      throw new Error('Queue item has no sender data')
    }

    await this.db.bannedSender.upsert({
      where: {
        userId_senderTelegramId: {
          userId: item.userId,
          senderTelegramId: item.senderTelegramId
        }
      },
      create: {
        userId: item.userId,
        senderTelegramId: item.senderTelegramId,
        senderUsername: item.senderUsername,
        senderName: item.senderName
      },
      update: {
        senderUsername: item.senderUsername,
        senderName: item.senderName
      }
    })
  }

  public async unbanQueueItemSender(item: TQueueItemWithOwner): Promise<void> {
    if (item.senderTelegramId === null) {
      return
    }

    await this.db.bannedSender.deleteMany({
      where: {
        userId: item.userId,
        senderTelegramId: item.senderTelegramId
      }
    })
  }

  public async listByUserId(userId: string): Promise<IBannedSenderDto[]> {
    const items = await this.db.bannedSender.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    return items.map((item) => ({
      id: item.id,
      telegramId: item.senderTelegramId.toString(),
      username: item.senderUsername,
      name: item.senderName,
      bannedAt: item.createdAt.toISOString()
    }))
  }

  public async removeById(userId: string, id: string): Promise<boolean> {
    const result = await this.db.bannedSender.deleteMany({
      where: { id, userId }
    })

    return result.count > 0
  }
}
