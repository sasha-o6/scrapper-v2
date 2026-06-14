import { createHmac, timingSafeEqual } from 'node:crypto'

const INIT_DATA_MAX_AGE_SECONDS = 86_400

export interface ITelegramInitUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface IVerifiedInitData {
  user: ITelegramInitUser
  userId: bigint
  authDate: Date
}

const safeCompareHex = (expected: string, actual: string): boolean => {
  if (!/^[a-f0-9]+$/i.test(actual) || actual.length !== expected.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))
}

export const verifyTelegramInitData = (
  initData: string,
  botToken: string,
  now: Date = new Date(),
  maxAgeSeconds: number = INIT_DATA_MAX_AGE_SECONDS
): IVerifiedInitData => {
  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  const rawUser = params.get('user')
  const rawAuthDate = params.get('auth_date')

  if (!receivedHash || !rawUser || !rawAuthDate) {
    throw new Error('Invalid Telegram initData payload')
  }

  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (!safeCompareHex(expectedHash, receivedHash)) {
    throw new Error('Telegram initData signature mismatch')
  }

  const authDateSeconds = Number(rawAuthDate)

  if (!Number.isFinite(authDateSeconds)) {
    throw new Error('Invalid Telegram auth_date')
  }

  const ageSeconds = Math.floor((now.getTime() - authDateSeconds * 1000) / 1000)

  if (ageSeconds > maxAgeSeconds) {
    throw new Error('Telegram initData expired')
  }

  const user = JSON.parse(rawUser) as ITelegramInitUser

  if (!Number.isFinite(user.id)) {
    throw new Error('Telegram initData user is missing')
  }

  return {
    user,
    userId: BigInt(user.id),
    authDate: new Date(authDateSeconds * 1000)
  }
}
