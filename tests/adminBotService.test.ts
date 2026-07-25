import { describe, expect, test } from 'bun:test'

import { AdminBotService } from '@backend/services/AdminBotService'
import type { AdminLoginWebService } from '@backend/services/AdminLoginWebService'
import type { BotApiClient, IBotApiUpdate } from '@backend/services/BotApiClient'
import type { ClientManager } from '@backend/services/ClientManager'
import type { SenderBanService, TQueueItemWithOwner } from '@backend/services/SenderBanService'
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

const USER_ID = 777n

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
    telegramId: USER_ID
  },
  ...overrides
})

interface IBanFixture {
  service: AdminBotService
  messages: Array<{ chatId: string; text: string }>
  callbackAnswers: Array<{ id: string; text?: string }>
  keyboardEdits: Array<{ chatId: number | string; messageId: number; replyMarkup: unknown }>
  userbotEdits: Array<{ targetChat: string; messageId: number }>
  banned: string[]
  unbanned: string[]
}

const createBanFixture = (update: IBotApiUpdate, queueItem: TQueueItemWithOwner | null): IBanFixture => {
  const messages: IBanFixture['messages'] = []
  const callbackAnswers: IBanFixture['callbackAnswers'] = []
  const keyboardEdits: IBanFixture['keyboardEdits'] = []
  const userbotEdits: IBanFixture['userbotEdits'] = []
  const banned: string[] = []
  const unbanned: string[] = []
  const botApiClient = {
    getUpdates: async () => [update],
    sendMessage: async (chatId: string, text: string) => {
      messages.push({ chatId, text })
    },
    answerCallbackQuery: async (id: string, text?: string) => {
      callbackAnswers.push({ id, text })
    },
    editMessageReplyMarkup: async (
      chatId: number | string,
      messageId: number,
      replyMarkup: unknown
    ) => {
      keyboardEdits.push({ chatId, messageId, replyMarkup })
    }
  } as unknown as BotApiClient
  const clientManager = {
    getAuthStatus: async () => 'LOGGED_IN',
    isAuthorized: async () => true,
    editSystemMessageText: async (targetChat: string, messageId: number) => {
      userbotEdits.push({ targetChat, messageId })

      return true
    }
  } as unknown as ClientManager
  const adminLoginWebService = {
    issueLoginUrl: () => 'https://example.test/admin/login/token'
  } as unknown as AdminLoginWebService
  const senderBanService = {
    resolveQueueItemForRequester: async (queueItemId: string, requesterTelegramId: bigint) => {
      if (!queueItem || queueItem.id !== queueItemId) {
        return { ok: false, reason: 'Повідомлення не знайдено' }
      }

      if (queueItem.user.telegramId !== requesterTelegramId) {
        return { ok: false, reason: 'Це повідомлення належить іншому користувачу' }
      }

      return { ok: true, item: queueItem }
    },
    banQueueItemSender: async (item: TQueueItemWithOwner) => {
      banned.push(item.id)
    },
    unbanQueueItemSender: async (item: TQueueItemWithOwner) => {
      unbanned.push(item.id)
    }
  } as unknown as SenderBanService

  return {
    service: new AdminBotService(
      botApiClient,
      clientManager,
      adminLoginWebService,
      ADMIN_ID,
      1000,
      senderBanService
    ),
    messages,
    callbackAnswers,
    keyboardEdits,
    userbotEdits,
    banned,
    unbanned
  }
}

const createCallbackUpdate = (data: string, fromId: bigint): IBotApiUpdate => ({
  update_id: 2,
  callback_query: {
    id: 'cb-1',
    from: {
      id: Number(fromId)
    },
    message: {
      message_id: 55,
      chat: {
        id: Number(fromId)
      }
    },
    data
  }
})

const createUserMessageUpdate = (text: string, fromId: bigint): IBotApiUpdate => ({
  update_id: 3,
  message: {
    message_id: 10,
    chat: {
      id: Number(fromId)
    },
    from: {
      id: Number(fromId)
    },
    text
  }
})

describe('AdminBotService sender bans', () => {
  test('bans sender from callback button and toggles it to unban', async () => {
    const fixture = createBanFixture(
      createCallbackUpdate('ban:queue-1', USER_ID),
      createQueueItem()
    )

    await fixture.service.poll()

    expect(fixture.banned).toEqual(['queue-1'])
    expect(fixture.callbackAnswers).toEqual([{ id: 'cb-1', text: 'Користувача заблоковано' }])
    expect(fixture.keyboardEdits).toHaveLength(1)
    expect(fixture.keyboardEdits[0].replyMarkup).toEqual({
      inline_keyboard: [
        [
          {
            text: '✅ Розблокувати користувача',
            callback_data: 'unban:queue-1'
          }
        ]
      ]
    })
  })

  test('unbans sender from callback button and toggles it back', async () => {
    const fixture = createBanFixture(
      createCallbackUpdate('unban:queue-1', USER_ID),
      createQueueItem()
    )

    await fixture.service.poll()

    expect(fixture.unbanned).toEqual(['queue-1'])
    expect(fixture.callbackAnswers).toEqual([{ id: 'cb-1', text: 'Користувача розблоковано' }])
    expect(fixture.keyboardEdits[0].replyMarkup).toEqual({
      inline_keyboard: [
        [
          {
            text: '🚫 Заблокувати користувача',
            callback_data: 'ban:queue-1'
          }
        ]
      ]
    })
  })

  test('rejects callback from a different user without banning', async () => {
    const fixture = createBanFixture(
      createCallbackUpdate('ban:queue-1', 555n),
      createQueueItem()
    )

    await fixture.service.poll()

    expect(fixture.banned).toEqual([])
    expect(fixture.callbackAnswers).toEqual([
      { id: 'cb-1', text: 'Це повідомлення належить іншому користувачу' }
    ])
    expect(fixture.keyboardEdits).toHaveLength(0)
  })

  test('bans sender from deep link and edits the userbot message', async () => {
    const fixture = createBanFixture(
      createUserMessageUpdate('/start ban_queue-1', USER_ID),
      createQueueItem()
    )

    await fixture.service.poll()

    expect(fixture.banned).toEqual(['queue-1'])
    expect(fixture.userbotEdits).toEqual([
      { targetChat: '@target_channel', messageId: 91 },
      { targetChat: '@target_channel', messageId: 91 }
    ])
    expect(fixture.messages).toEqual([
      { chatId: USER_ID.toString(), text: '✅ Користувача заблоковано' }
    ])
  })

  test('replies with an error for a deep link to an unknown message', async () => {
    const fixture = createBanFixture(
      createUserMessageUpdate('/start ban_missing', USER_ID),
      createQueueItem()
    )

    await fixture.service.poll()

    expect(fixture.banned).toEqual([])
    expect(fixture.userbotEdits).toEqual([])
    expect(fixture.messages).toEqual([
      { chatId: USER_ID.toString(), text: 'Повідомлення не знайдено' }
    ])
  })
})
