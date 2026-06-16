import { describe, expect, test } from 'bun:test'
import { md } from '@mtcute/markdown-parser'

import {
  escapeMarkdown,
  formatChannelLink,
  formatClickablePostLink,
  formatForwardedMessage,
  getChannelLinkFromPostLink
} from '@backend/services/Formatter'

describe('Formatter', () => {
  test('escapes mtcute markdown control characters', () => {
    expect(escapeMarkdown('**bold** [link](https://example.com)')).toBe(
      '\\*\\*bold\\*\\* \\[link\\](https://example.com)'
    )
  })

  test('formats message with escaped original text', () => {
    const formatted = formatForwardedMessage({
      channelTitle: 'Deals',
      channel: '@deals',
      dateUnixSeconds: 1_700_000_000,
      messageText: 'price is 10.00!',
      keyWords: [['price'], ['10.00']],
      postLink: 'https://t.me/deals/1'
    })

    expect(formatted).toContain('price is 10.00!')
    expect(formatted).toContain('🔑 Ключові слова:')
    expect(formatted).toContain('https://t.me/deals/1')
    expect(formatted).not.toContain('https://t\\.me/deals/1')
  })

  test('links channel label to the channel', () => {
    const parsed = md(
      formatForwardedMessage({
        channelTitle: 'Deals',
        channel: '@deals',
        dateUnixSeconds: 1_700_000_000,
        messageText: 'plain text',
        keyWords: [['plain']],
        postLink: 'https://t.me/deals/1'
      })
    )

    expect(parsed.text).toContain('Канал/чат: Deals')
    expect(
      parsed.entities?.some(
        (entity) =>
          entity._ === 'messageEntityTextUrl' &&
          entity.offset === '📺 Канал/чат: '.length &&
          entity.length === 'Deals'.length &&
          entity.url === 'https://t.me/deals'
      ) ?? false
    ).toBe(true)
  })

  test('derives channel links from Telegram post links', () => {
    expect(getChannelLinkFromPostLink('https://t.me/deals/1')).toBe('https://t.me/deals')
    expect(getChannelLinkFromPostLink('t.me/c/2670916394/42')).toBe(
      'https://t.me/c/2670916394'
    )
  })

  test('links public channel usernames when post link is unavailable', () => {
    expect(formatChannelLink('@deals_ua')).toBe('https://t.me/deals_ua')
  })

  test('normalizes Telegram post links for client auto-linking', () => {
    expect(formatClickablePostLink('t.me/deals/1')).toBe('https://t.me/deals/1')
    expect(formatClickablePostLink('https://t.me/deals/1')).toBe('https://t.me/deals/1')
  })
})
