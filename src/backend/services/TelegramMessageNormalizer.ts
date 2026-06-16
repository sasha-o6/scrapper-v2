export interface INormalizedTelegramMessage {
  channelId: string
  messageId: string
  channelTitle: string | null
  channelUsername: string | null
  channel: string
  dateUnixSeconds: number
  messageText: string
  postLink: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const asString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString()
  }

  return null
}

const getRecordValue = (record: Record<string, unknown>, key: string): unknown => {
  try {
    return record[key]
  } catch {
    return undefined
  }
}

const getFirstString = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = asString(getRecordValue(record, key))

    if (value) {
      return value
    }
  }

  return null
}

const getUnixDate = (value: unknown): number => {
  if (value instanceof Date) {
    return Math.floor(value.getTime() / 1000)
  }

  if (typeof value === 'number') {
    return value > 9_999_999_999 ? Math.floor(value / 1000) : value
  }

  return Math.floor(Date.now() / 1000)
}

const buildPostLink = (
  username: string | null,
  messageId: string,
  fallback: string | null
): string => {
  if (fallback) {
    return fallback
  }

  if (username) {
    return `https://t.me/${username.replace(/^@/, '')}/${messageId}`
  }

  return ''
}

export const normalizeTelegramMessage = (
  rawMessage: unknown
): INormalizedTelegramMessage | null => {
  if (!isRecord(rawMessage)) {
    return null
  }

  const messageText = getFirstString(rawMessage, ['text', 'message', 'rawText'])

  if (!messageText) {
    return null
  }

  const rawChat = getRecordValue(rawMessage, 'chat')
  const chat = isRecord(rawChat) ? rawChat : {}
  const messageId = getFirstString(rawMessage, ['id', 'messageId']) ?? crypto.randomUUID()
  const channelId =
    getFirstString(chat, ['id', 'chatId']) ??
    getFirstString(rawMessage, ['chatId', 'peerId']) ??
    'unknown'
  const username = getFirstString(chat, ['username'])
  const channelTitle = getFirstString(chat, ['title', 'displayName', 'name'])
  const channel = channelTitle ?? username ?? channelId
  const postLink = buildPostLink(username, messageId, getFirstString(rawMessage, ['link']))

  return {
    channelId,
    messageId,
    channelTitle,
    channelUsername: username,
    channel,
    dateUnixSeconds: getUnixDate(getRecordValue(rawMessage, 'date')),
    messageText,
    postLink
  }
}
