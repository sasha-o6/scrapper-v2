import { describe, expect, test } from 'bun:test'

import {
  SenderBanService,
  parseBanCallbackData,
  type TQueueItemWithOwner
} from '@backend/services/SenderBanService'

const createQueueItem = (overrides?: Partial<TQueueItemWithOwner>): TQueueItemWithOwner => ({
  id: 'queue-1',
  userId: 'user-1',
  messageText: 'base message',
  status: 'SENT',
  targetChat: '@target_channel',
  error: null,
  senderTelegramId: 999n,
  senderUsername: 'spammer',
  senderName: 'Spammer',
  sentMessageId: 91n,
  createdAt: new Date('2026-06-16T10:00:00.000Z'),
  updatedAt: new Date('2026-06-16T10:00:00.000Z'),
  sentAt: new Date('2026-06-16T10:00:00.000Z'),
  user: {
    telegramId: 777n
  },
  ...overrides
})

describe('SenderBanService', () => {
  test('resolves queue item only for its owner', async () => {
    const db = {
      messageQueue: {
        findUnique: async () => createQueueItem()
      }
    }
    const service = new SenderBanService(db as never)

    const owned = await service.resolveQueueItemForRequester('queue-1', 777n)
    const foreign = await service.resolveQueueItemForRequester('queue-1', 555n)

    expect(owned.ok).toBe(true)
    expect(foreign).toEqual({
      ok: false,
      reason: 'Це повідомлення належить іншому користувачу'
    })
  })

  test('rejects unknown queue items and items without sender data', async () => {
    let nextItem: TQueueItemWithOwner | null = null
    const db = {
      messageQueue: {
        findUnique: async () => nextItem
      }
    }
    const service = new SenderBanService(db as never)

    expect(await service.resolveQueueItemForRequester('missing', 777n)).toEqual({
      ok: false,
      reason: 'Повідомлення не знайдено'
    })

    nextItem = createQueueItem({ senderTelegramId: null })
    expect(await service.resolveQueueItemForRequester('queue-1', 777n)).toEqual({
      ok: false,
      reason: 'Для цього повідомлення немає даних про відправника'
    })
  })

  test('bans sender with data taken from the queue row only', async () => {
    const upserts: unknown[] = []
    const db = {
      bannedSender: {
        upsert: async (payload: unknown) => {
          upserts.push(payload)

          return payload
        }
      }
    }
    const service = new SenderBanService(db as never)

    await service.banQueueItemSender(createQueueItem())

    expect(upserts).toEqual([
      {
        where: {
          userId_senderTelegramId: {
            userId: 'user-1',
            senderTelegramId: 999n
          }
        },
        create: {
          userId: 'user-1',
          senderTelegramId: 999n,
          senderUsername: 'spammer',
          senderName: 'Spammer'
        },
        update: {
          senderUsername: 'spammer',
          senderName: 'Spammer'
        }
      }
    ])
  })

  test('unbans sender by user and sender id', async () => {
    const deletes: unknown[] = []
    const db = {
      bannedSender: {
        deleteMany: async (payload: unknown) => {
          deletes.push(payload)

          return { count: 1 }
        }
      }
    }
    const service = new SenderBanService(db as never)

    await service.unbanQueueItemSender(createQueueItem())

    expect(deletes).toEqual([
      {
        where: {
          userId: 'user-1',
          senderTelegramId: 999n
        }
      }
    ])
  })

  test('lists banned senders as DTOs and removes them by id', async () => {
    const db = {
      bannedSender: {
        findMany: async () => [
          {
            id: 'ban-1',
            userId: 'user-1',
            senderTelegramId: 999n,
            senderUsername: 'spammer',
            senderName: 'Spammer',
            createdAt: new Date('2026-06-16T10:00:00.000Z')
          }
        ],
        deleteMany: async ({ where }: { where: { id: string } }) => ({
          count: where.id === 'ban-1' ? 1 : 0
        })
      }
    }
    const service = new SenderBanService(db as never)

    expect(await service.listByUserId('user-1')).toEqual([
      {
        id: 'ban-1',
        telegramId: '999',
        username: 'spammer',
        name: 'Spammer',
        bannedAt: '2026-06-16T10:00:00.000Z'
      }
    ])
    expect(await service.removeById('user-1', 'ban-1')).toBe(true)
    expect(await service.removeById('user-1', 'missing')).toBe(false)
  })

  test('parses ban callback data', () => {
    expect(parseBanCallbackData('ban:queue-1')).toEqual({
      type: 'ban',
      queueItemId: 'queue-1'
    })
    expect(parseBanCallbackData('unban:queue-1')).toEqual({
      type: 'unban',
      queueItemId: 'queue-1'
    })
    expect(parseBanCallbackData('other:queue-1')).toBeNull()
  })
})
