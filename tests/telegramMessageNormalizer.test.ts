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
      postLink: ''
    })
  })
})
