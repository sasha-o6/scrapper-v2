import { describe, expect, test } from 'bun:test'
import { md } from '@mtcute/markdown-parser'

import {
  escapeMarkdown,
  formatClickablePostLink,
  formatForwardedMessage
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
    expect(formatted).toContain('**Ключові слова:**')
    expect(formatted).toContain('https://t.me/deals/1')
    expect(formatted).not.toContain('https://t\\.me/deals/1')
  })

  test('parses labels as Telegram bold entities', () => {
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
    expect(parsed.text).not.toContain('**Канал/чат:**')
    expect(
      parsed.entities?.some(
        (entity) =>
          entity._ === 'messageEntityBold' &&
          entity.offset === 0 &&
          entity.length === 'Канал/чат:'.length
      ) ?? false
    ).toBe(true)
  })

  test('normalizes Telegram post links for client auto-linking', () => {
    expect(formatClickablePostLink('t.me/deals/1')).toBe('https://t.me/deals/1')
    expect(formatClickablePostLink('https://t.me/deals/1')).toBe('https://t.me/deals/1')
  })
})
