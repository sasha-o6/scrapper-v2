import { describe, expect, test } from 'bun:test'
import type { Config, Prisma } from '@prisma/client'

import { ConfigService, type IChannelJoiner } from '@backend/services/ConfigService'
import type { SystemStateService } from '@backend/services/SystemStateService'

const createConfig = (data?: Partial<Config>): Config => ({
  id: 'config-1',
  userId: 'user-1',
  targetChat: null,
  isActive: true,
  channels: [],
  channelItems: [],
  keyWords: [],
  strictMode: false,
  additionalWords: [],
  banWords: [],
  historyDepthDays: 1,
  createdAt: new Date('2026-06-16T10:00:00.000Z'),
  updatedAt: new Date('2026-06-16T10:00:00.000Z'),
  ...data
})

describe('ConfigService join throttling', () => {
  test('waits between new channel join attempts', async () => {
    const joinTimes: number[] = []
    const db = {
      user: {
        upsert: async () => ({ id: 'user-1', telegramId: 777n })
      },
      config: {
        upsert: async () => createConfig(),
        update: async ({ data }: { data: Prisma.ConfigUpdateInput }) =>
          createConfig({
            channels: data.channels as string[],
            channelItems: data.channelItems as Prisma.JsonValue
          })
      }
    }
    const systemStateService = {
      getStatus: async () => 'LOGGED_IN'
    } as unknown as SystemStateService
    const channelJoiner: IChannelJoiner = {
      joinChannel: async () => {
        joinTimes.push(Date.now())

        return { status: 'JOINED' }
      }
    }
    const service = new ConfigService(
      db as never,
      systemStateService,
      20
    )

    service.setChannelJoiner(channelJoiner)

    await service.updateConfigByTelegramId(777n, {
      channels: [
        { title: 'One', value: '@one' },
        { title: 'Two', value: '@two' }
      ]
    })

    expect(joinTimes).toHaveLength(2)
    expect(joinTimes[1] - joinTimes[0]).toBeGreaterThanOrEqual(15)
  })
})
