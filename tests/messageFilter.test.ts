import { describe, expect, test } from 'bun:test'

import { filterMessage } from '@backend/services/MessageFilter'

describe('filterMessage', () => {
  test('accepts a keyword match when strict mode is off', () => {
    const result = filterMessage('Продам Tesla у Києві', {
      keyWords: ['tesla', 'bmw'],
      strictMode: false,
      additionalWords: [],
      banWords: []
    })

    expect(result.accepted).toBe(true)
    expect(result.matchedKeyWords).toEqual(['tesla'])
  })

  test('rejects message with ban words before keyword checks', () => {
    const result = filterMessage('Tesla scam offer', {
      keyWords: ['tesla'],
      strictMode: false,
      additionalWords: [],
      banWords: ['scam']
    })

    expect(result.accepted).toBe(false)
    expect(result.rejectionReason).toBe('BAN_WORD')
  })

  test('requires all additional words in strict mode', () => {
    const result = filterMessage('Tesla Київ', {
      keyWords: ['tesla'],
      strictMode: true,
      additionalWords: ['Київ', 'терміново'],
      banWords: []
    })

    expect(result.accepted).toBe(false)
    expect(result.rejectionReason).toBe('STRICT_MISS')
  })
})
