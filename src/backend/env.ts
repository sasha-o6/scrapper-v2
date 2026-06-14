interface IEnvironment {
  databaseUrl: string
  botToken: string
  telegramApiId: number
  telegramApiHash: string
  port: number
  queueIntervalMs: number
  allowDevAuth: boolean
  devTelegramId: bigint | null
  nodeEnv: string
}

const readRequired = (key: string): string => {
  const value = process.env[key]

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

const readNumber = (key: string, fallback?: number): number => {
  const rawValue = process.env[key]

  if (!rawValue) {
    if (fallback !== undefined) {
      return fallback
    }

    throw new Error(`Missing required numeric environment variable: ${key}`)
  }

  const parsed = Number(rawValue)

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric environment variable: ${key}`)
  }

  return parsed
}

const readBoolean = (key: string, fallback: boolean): boolean => {
  const value = process.env[key]

  if (!value) {
    return fallback
  }

  return value === 'true'
}

const readOptionalBigInt = (key: string): bigint | null => {
  const value = process.env[key]

  if (!value) {
    return null
  }

  return BigInt(value)
}

export const env: IEnvironment = {
  databaseUrl: readRequired('DATABASE_URL'),
  botToken: readRequired('BOT_TOKEN'),
  telegramApiId: readNumber('TELEGRAM_API_ID'),
  telegramApiHash: readRequired('TELEGRAM_API_HASH'),
  port: readNumber('PORT', 3000),
  queueIntervalMs: readNumber('QUEUE_INTERVAL_MS', 4000),
  allowDevAuth: readBoolean('ALLOW_DEV_AUTH', false),
  devTelegramId: readOptionalBigInt('DEV_TELEGRAM_ID'),
  nodeEnv: process.env.NODE_ENV ?? 'development'
}
