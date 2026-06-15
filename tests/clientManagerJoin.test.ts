import { describe, expect, test } from 'bun:test'

import { ClientManager } from '@backend/services/ClientManager'
import type { ScraperService } from '@backend/services/ScraperService'
import type { SystemStateService } from '@backend/services/SystemStateService'
import type { TTelegramPeerInput } from '@backend/services/TelegramPeerRef'

interface IFakeClient {
  getChatCalls: TTelegramPeerInput[]
  joinChatCalls: TTelegramPeerInput[]
  getChat(chatId: TTelegramPeerInput): Promise<unknown>
  joinChat(chatId: TTelegramPeerInput): Promise<unknown>
}

const createManager = (client: IFakeClient): ClientManager => {
  const manager = new ClientManager(
    {} as unknown as ScraperService,
    {} as unknown as SystemStateService
  )

  ;(manager as unknown as { client: IFakeClient }).client = client

  return manager
}

describe('ClientManager.joinChannel', () => {
  test('marks private numeric chat as joined when central userbot already has access', async () => {
    const client: IFakeClient = {
      getChatCalls: [],
      joinChatCalls: [],
      getChat: async (chatId) => {
        client.getChatCalls.push(chatId)

        return {}
      },
      joinChat: async (chatId) => {
        client.joinChatCalls.push(chatId)

        return { status: 'ok' }
      }
    }
    const result = await createManager(client).joinChannel('-1001234567890')

    expect(result).toEqual({ status: 'JOINED' })
    expect(client.getChatCalls).toEqual([-1_001_234_567_890])
    expect(client.joinChatCalls).toEqual([])
  })

  test('treats bare numeric channel id as mtcute marked channel id first', async () => {
    const client: IFakeClient = {
      getChatCalls: [],
      joinChatCalls: [],
      getChat: async (chatId) => {
        client.getChatCalls.push(chatId)

        if (chatId !== -1_002_670_916_394) {
          throw new Error('not found')
        }

        return {}
      },
      joinChat: async (chatId) => {
        client.joinChatCalls.push(chatId)

        return { status: 'ok' }
      }
    }
    const result = await createManager(client).joinChannel('2670916394')

    expect(result).toEqual({ status: 'JOINED' })
    expect(client.getChatCalls).toEqual([-1_002_670_916_394])
    expect(client.joinChatCalls).toEqual([])
  })

  test('falls back to existing access check when joinChat reports private channel', async () => {
    const client: IFakeClient = {
      getChatCalls: [],
      joinChatCalls: [],
      getChat: async (chatId) => {
        client.getChatCalls.push(chatId)

        return {}
      },
      joinChat: async (chatId) => {
        client.joinChatCalls.push(chatId)

        throw new Error('CHANNEL_PRIVATE')
      }
    }
    const result = await createManager(client).joinChannel('@private_channel')

    expect(result).toEqual({ status: 'JOINED' })
    expect(client.getChatCalls).toEqual(['@private_channel'])
    expect(client.joinChatCalls).toEqual(['@private_channel'])
  })

  test('passes numeric channel id to joinChat instead of username string', async () => {
    const client: IFakeClient = {
      getChatCalls: [],
      joinChatCalls: [],
      getChat: async (chatId) => {
        client.getChatCalls.push(chatId)

        throw new Error('not joined')
      },
      joinChat: async (chatId) => {
        client.joinChatCalls.push(chatId)

        return { status: 'ok' }
      }
    }
    const result = await createManager(client).joinChannel('-1002670916394')

    expect(result).toEqual({ status: 'JOINED' })
    expect(client.getChatCalls).toEqual([-1_002_670_916_394])
    expect(client.joinChatCalls).toEqual([-1_002_670_916_394])
  })

  test('checks private t.me/c links as numeric channel ids', async () => {
    const client: IFakeClient = {
      getChatCalls: [],
      joinChatCalls: [],
      getChat: async (chatId) => {
        client.getChatCalls.push(chatId)

        return {}
      },
      joinChat: async (chatId) => {
        client.joinChatCalls.push(chatId)

        return { status: 'ok' }
      }
    }
    const result = await createManager(client).joinChannel('https://t.me/c/2670916394/42')

    expect(result).toEqual({ status: 'JOINED' })
    expect(client.getChatCalls).toEqual([-1_002_670_916_394])
    expect(client.joinChatCalls).toEqual([])
  })
})
