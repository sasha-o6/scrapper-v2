import { describe, expect, test } from 'bun:test'

import { AdminBotService } from '@backend/services/AdminBotService'
import type { AdminLoginWebService } from '@backend/services/AdminLoginWebService'
import type { BotApiClient, IBotApiUpdate } from '@backend/services/BotApiClient'
import type { ClientManager } from '@backend/services/ClientManager'
import type { TSystemAuthStatus } from '@shared/types'

const ADMIN_ID = 123456n

interface IFixture {
  service: AdminBotService
  messages: string[]
  getLoginStarted(): boolean
  getCode(): string
  getPassword(): string
}

const createUpdate = (text: string): IBotApiUpdate => ({
  update_id: 1,
  message: {
    message_id: 1,
    chat: {
      id: Number(ADMIN_ID)
    },
    from: {
      id: Number(ADMIN_ID)
    },
    text
  }
})

const createFixture = (
  authStatus: TSystemAuthStatus,
  text: string
): IFixture => {
  let loginStarted = false
  let code = ''
  let password = ''
  const messages: string[] = []
  const botApiClient = {
    getUpdates: async () => [createUpdate(text)],
    sendMessage: async (_chatId: string, message: string) => {
      messages.push(message)
    }
  } as unknown as BotApiClient
  const clientManager = {
    getAuthStatus: async () => authStatus,
    isAuthorized: async () => authStatus === 'LOGGED_IN',
    sendCodeToAdmin: async () => {
      loginStarted = true

      return { step: 'code' }
    },
    signInWithCode: async (nextCode: string) => {
      code = nextCode

      return { step: 'authorized' }
    },
    checkPassword: async (nextPassword: string) => {
      password = nextPassword

      return { step: 'authorized' }
    }
  } as unknown as ClientManager
  const adminLoginWebService = {
    issueLoginUrl: () => 'https://example.test/admin/login/token'
  } as unknown as AdminLoginWebService

  return {
    service: new AdminBotService(
      botApiClient,
      clientManager,
      adminLoginWebService,
      ADMIN_ID,
      1000
    ),
    messages,
    getLoginStarted: () => loginStarted,
    getCode: () => code,
    getPassword: () => password
  }
}

describe('AdminBotService', () => {
  test('sends web login link after login command', async () => {
    const fixture = createFixture('AUTH_PENDING', '/login')

    await fixture.service.poll()

    expect(fixture.getLoginStarted()).toBe(true)
    expect(fixture.messages).toEqual([
      'Код надіслано. Не надсилай його в Telegram чат.\nВведи код на сторінці: https://example.test/admin/login/token'
    ])
  })

  test('does not accept login code in Telegram chat while code is pending', async () => {
    const fixture = createFixture('CODE_SENT', '76541')

    await fixture.service.poll()

    expect(fixture.getCode()).toBe('')
    expect(fixture.messages).toEqual([
      'Не надсилай код або 2FA пароль у Telegram чат. Якщо вже надіслав код сюди, запроси новий через /login і введи його тільки на сторінці з посилання.'
    ])
  })

  test('does not accept 2FA password in Telegram chat while password is pending', async () => {
    const fixture = createFixture('PASSWORD_PENDING', 'top secret')

    await fixture.service.poll()

    expect(fixture.getPassword()).toBe('')
    expect(fixture.messages).toEqual([
      'Не надсилай код або 2FA пароль у Telegram чат. Якщо вже надіслав код сюди, запроси новий через /login і введи його тільки на сторінці з посилання.'
    ])
  })

  test('asks for login on unrelated text while auth is pending', async () => {
    const fixture = createFixture('AUTH_PENDING', '76541')

    await fixture.service.poll()

    expect(fixture.getCode()).toBe('')
    expect(fixture.messages).toEqual(['⚠️ Userbot розлогінений. Надішли /login'])
  })
})
