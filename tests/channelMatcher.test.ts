import { describe, expect, test } from 'bun:test'

import {
  isMessageFromConfiguredChannel,
  normalizeChannelRef
} from '@backend/services/ChannelMatcher'
import type { INormalizedTelegramMessage } from '@backend/services/TelegramMessageNormalizer'

const createMessage = (): INormalizedTelegramMessage => ({
  channelId: '-100123',
  messageId: '42',
  channelTitle: 'Deals UA',
  channelUsername: 'deals_ua',
  channel: 'Deals UA',
  dateUnixSeconds: 1_700_000_000,
  messageText: 'Tesla price drop',
  postLink: 'https://t.me/deals_ua/42'
})

describe('ChannelMatcher', () => {
  test('normalizes public Telegram channel URLs and handles', () => {
    expect(normalizeChannelRef('https://t.me/deals_ua/42')).toBe('deals_ua')
    expect(normalizeChannelRef('@Deals_UA')).toBe('deals_ua')
    expect(normalizeChannelRef('t.me/deals_ua')).toBe('deals_ua')
    expect(normalizeChannelRef('https://t.me/c/2670916394/42')).toBe('2670916394')
  })

  test('matches configured channel by username, title, or numeric id', () => {
    const message = createMessage()

    expect(isMessageFromConfiguredChannel(message, '@deals_ua')).toBe(true)
    expect(isMessageFromConfiguredChannel(message, 'Deals UA')).toBe(true)
    expect(isMessageFromConfiguredChannel(message, '-100123')).toBe(true)
    expect(isMessageFromConfiguredChannel(message, '123')).toBe(true)
    expect(isMessageFromConfiguredChannel(message, '@other')).toBe(false)
  })
})
