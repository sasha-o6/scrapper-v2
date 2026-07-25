import { describe, expect, test } from 'bun:test'
import type { Config } from '@prisma/client'

import { ScraperService } from '@backend/services/ScraperService'
import type { INormalizedTelegramMessage } from '@backend/services/TelegramMessageNormalizer'

const createConfig = (): Config => ({
  id: 'config-1',
  userId: 'user-1',
  targetChat: '@target_channel',
  isActive: true,
  channels: ['@deals_ua'],
  channelItems: [],
  keyWords: ['tesla'],
  strictMode: false,
  additionalWords: [],
  banWords: [],
  historyDepthDays: 1,
  createdAt: new Date('2026-06-16T10:00:00.000Z'),
  updatedAt: new Date('2026-06-16T10:00:00.000Z')
})

const createMessage = (): INormalizedTelegramMessage => ({
  channelId: '-100123',
  messageId: '42',
  channelTitle: 'Deals UA',
  channelUsername: 'deals_ua',
  channel: 'Deals UA',
  dateUnixSeconds: 1_700_000_000,
  messageText: 'Tesla price drop',
  postLink: 'https://t.me/deals_ua/42',
  sender: {
    id: '999',
    username: 'spammer',
    displayName: 'Spammer'
  }
})

interface IFixture {
  service: ScraperService
  queueInserts: Array<{ data: Record<string, unknown> }>
}

const createFixture = (isSenderBanned: boolean): IFixture => {
  const queueInserts: IFixture['queueInserts'] = []
  const db = {
    config: {
      findMany: async () => [createConfig()]
    },
    bannedSender: {
      findUnique: async () => (isSenderBanned ? { id: 'ban-1' } : null)
    },
    processedMessage: {
      create: async () => ({})
    },
    messageQueue: {
      create: async (payload: { data: Record<string, unknown> }) => {
        queueInserts.push(payload)

        return payload
      }
    }
  }

  return {
    service: new ScraperService(db as never),
    queueInserts
  }
}

describe('ScraperService sender bans', () => {
  test('skips messages from banned senders', async () => {
    const fixture = createFixture(true)

    const queued = await fixture.service.processRealtimeMessage(createMessage())

    expect(queued).toBe(0)
    expect(fixture.queueInserts).toHaveLength(0)
  })

  test('queues messages with sender data when sender is not banned', async () => {
    const fixture = createFixture(false)

    const queued = await fixture.service.processRealtimeMessage(createMessage())

    expect(queued).toBe(1)
    expect(fixture.queueInserts).toHaveLength(1)
    expect(fixture.queueInserts[0].data.senderTelegramId).toBe(999n)
    expect(fixture.queueInserts[0].data.senderUsername).toBe('spammer')
    expect(fixture.queueInserts[0].data.senderName).toBe('Spammer')
  })
})
