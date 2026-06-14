import { describe, expect, test } from 'bun:test'

import { escapeMarkdownV2, formatForwardedMessage } from '@backend/services/Formatter'

describe('Formatter', () => {
  test('escapes MarkdownV2 special characters', () => {
    expect(escapeMarkdownV2('a_b*c[1](x)!')).toBe('a\\_b\\*c\\[1\\]\\(x\\)\\!')
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

    expect(formatted).toContain('price is 10\\.00\\!')
    expect(formatted).toContain('*Ключові слова:*')
  })
})
