import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'bun:test'

import { verifyTelegramInitData } from '@backend/utils/telegramInitData'

const createInitData = (botToken: string, authDate: number): string => {
  const params = new URLSearchParams({
    auth_date: authDate.toString(),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify({
      id: 123456,
      first_name: 'Ada'
    })
  })
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
  params.set('hash', hash)

  return params.toString()
}

describe('verifyTelegramInitData', () => {
  test('validates signed init data', () => {
    const now = new Date('2026-06-14T12:00:00.000Z')
    const authDate = Math.floor(now.getTime() / 1000)
    const verified = verifyTelegramInitData(createInitData('bot-token', authDate), 'bot-token', now)

    expect(verified.userId).toBe(123456n)
    expect(verified.user.first_name).toBe('Ada')
  })

  test('rejects tampered init data', () => {
    const now = new Date('2026-06-14T12:00:00.000Z')
    const authDate = Math.floor(now.getTime() / 1000)
    const initData = createInitData('bot-token', authDate).replace('Ada', 'Grace')

    expect(() => verifyTelegramInitData(initData, 'bot-token', now)).toThrow()
  })
})
