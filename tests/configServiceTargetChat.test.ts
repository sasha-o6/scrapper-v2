import { describe, expect, test } from 'bun:test'
import type { Config, Prisma } from '@prisma/client'

import { ConfigService, type IDefaultTargetChatProvider } from '@backend/services/ConfigService'
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

const systemStateService = {
  getStatus: async () => 'LOGGED_IN'
} as unknown as SystemStateService

const botSelfProvider: IDefaultTargetChatProvider = {
  getSelfRef: async () => '@test_bot'
}

interface IFixture {
  service: ConfigService
  updates: Prisma.ConfigUpdateInput[]
}

const createFixture = (
  existingConfig: Config,
  provider: IDefaultTargetChatProvider | null = botSelfProvider
): IFixture => {
  const updates: Prisma.ConfigUpdateInput[] = []
  const db = {
    user: {
      upsert: async () => ({ id: 'user-1', telegramId: 777n })
    },
    config: {
      upsert: async () => existingConfig,
      update: async ({ data }: { data: Prisma.ConfigUpdateInput }) => {
        updates.push(data)

        return createConfig({
          ...existingConfig,
          targetChat:
            typeof data.targetChat === 'string' ? data.targetChat : existingConfig.targetChat
        })
      }
    }
  }
  const service = new ConfigService(db as never, systemStateService, 0, provider)

  return { service, updates }
}

describe('ConfigService default target chat', () => {
  test('backfills empty target chat with the bot self ref on read', async () => {
    const fixture = createFixture(createConfig({ targetChat: null }))

    const dto = await fixture.service.getConfigByTelegramId(777n)

    expect(fixture.updates).toEqual([{ targetChat: '@test_bot' }])
    expect(dto.targetChat).toBe('@test_bot')
  })

  test('keeps existing target chat untouched on read', async () => {
    const fixture = createFixture(createConfig({ targetChat: '@my_chat' }))

    const dto = await fixture.service.getConfigByTelegramId(777n)

    expect(fixture.updates).toHaveLength(0)
    expect(dto.targetChat).toBe('@my_chat')
  })

  test('restores the default when the user clears the field', async () => {
    const fixture = createFixture(createConfig({ targetChat: '@my_chat' }))

    const dto = await fixture.service.updateConfigByTelegramId(777n, { targetChat: '   ' })

    expect(fixture.updates).toEqual([{ targetChat: '@test_bot' }])
    expect(dto.targetChat).toBe('@test_bot')
  })

  test('keeps a user-provided target chat on update', async () => {
    const fixture = createFixture(createConfig({ targetChat: '@test_bot' }))

    const dto = await fixture.service.updateConfigByTelegramId(777n, {
      targetChat: '@another_chat'
    })

    expect(fixture.updates).toEqual([{ targetChat: '@another_chat' }])
    expect(dto.targetChat).toBe('@another_chat')
  })

  test('leaves target chat empty when no provider is available', async () => {
    const fixture = createFixture(createConfig({ targetChat: null }), null)

    const dto = await fixture.service.getConfigByTelegramId(777n)

    expect(fixture.updates).toHaveLength(0)
    expect(dto.targetChat).toBe('')
  })
})
