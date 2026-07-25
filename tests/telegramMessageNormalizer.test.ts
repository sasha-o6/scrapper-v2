import { describe, expect, test } from 'bun:test'

import { normalizeTelegramMessage } from '@backend/services/TelegramMessageNormalizer'

describe('TelegramMessageNormalizer', () => {
  test('normalizes messages from chats where mtcute cannot generate a message link', () => {
    const rawMessage = {
      id: 42,
      text: 'private group signal',
      date: new Date('2026-06-16T10:00:00.000Z'),
      chat: {
        id: -123456,
        title: 'Private Group'
      },
      get link(): string {
        throw new Error('Cannot generate message link for group')
      }
    }

    expect(normalizeTelegramMessage(rawMessage)).toEqual({
      channelId: '-123456',
      messageId: '42',
      channelTitle: 'Private Group',
      channelUsername: null,
      channel: 'Private Group',
      dateUnixSeconds: 1_781_604_000,
      messageText: 'private group signal',
      postLink: '',
      sender: null
    })
  })

  test('extracts a user sender', () => {
    const rawMessage = {
      id: 43,
      text: 'group message',
      date: new Date('2026-06-16T10:00:00.000Z'),
      chat: {
        id: -123456,
        title: 'Private Group'
      },
      sender: {
        type: 'user',
        id: 987654,
        username: 'john_doe',
        displayName: 'John Doe'
      }
    }

    expect(normalizeTelegramMessage(rawMessage)?.sender).toEqual({
      id: '987654',
      username: 'john_doe',
      displayName: 'John Doe'
    })
  })

  test('returns null sender for anonymous channel posts', () => {
    const rawMessage = {
      id: 44,
      text: 'channel post',
      date: new Date('2026-06-16T10:00:00.000Z'),
      chat: {
        id: -100999,
        title: 'Channel'
      },
      sender: {
        type: 'chat',
        id: -100999,
        title: 'Channel'
      }
    }

    expect(normalizeTelegramMessage(rawMessage)?.sender).toBeNull()
  })

  test('returns null sender when sender getter throws', () => {
    const rawMessage = {
      id: 45,
      text: 'weird message',
      date: new Date('2026-06-16T10:00:00.000Z'),
      chat: {
        id: -123456,
        title: 'Private Group'
      },
      get sender(): Record<string, unknown> {
        throw new Error('Cannot resolve sender')
      }
    }

    expect(normalizeTelegramMessage(rawMessage)?.sender).toBeNull()
  })
})
