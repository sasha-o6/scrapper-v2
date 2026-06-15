export type TTelegramPeerInput = string | number

const CHANNEL_MARK_OFFSET = 1_000_000_000_000
const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'])

const isSafeTelegramId = (value: number): boolean =>
  Number.isSafeInteger(value) && value !== 0

export const isNumericTelegramRef = (value: string): boolean => /^-?\d+$/.test(value.trim())

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '')

const getTelegramPath = (value: string): string | null => {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)

    if (!TELEGRAM_HOSTS.has(url.hostname.toLocaleLowerCase('en-US'))) {
      return null
    }

    return trimSlashes(url.pathname)
  } catch {
    return null
  }
}

const getTelegramInternalChannelId = (value: string): string | null => {
  const path = getTelegramPath(value)

  if (!path) {
    return null
  }

  const [firstSegment, secondSegment] = path.split('/')

  return firstSegment === 'c' && secondSegment && /^\d+$/.test(secondSegment)
    ? secondSegment
    : null
}

const toChannelMarkedId = (bareId: number): number | null => {
  if (bareId <= 0) {
    return null
  }

  const markedId = -CHANNEL_MARK_OFFSET - bareId

  return isSafeTelegramId(markedId) ? markedId : null
}

export const getMtcutePeerCandidates = (value: string): TTelegramPeerInput[] => {
  const trimmedValue = getTelegramInternalChannelId(value) ?? value.trim()

  if (!isNumericTelegramRef(trimmedValue)) {
    return [trimmedValue]
  }

  const numericId = Number(trimmedValue)

  if (!isSafeTelegramId(numericId)) {
    return [trimmedValue]
  }

  if (numericId > 0) {
    const channelMarkedId = toChannelMarkedId(numericId)

    return channelMarkedId ? [channelMarkedId, numericId] : [numericId]
  }

  return [numericId]
}

export const getPrimaryMtcutePeerInput = (value: string): TTelegramPeerInput =>
  getMtcutePeerCandidates(value)[0] ?? value.trim()

export const isTelegramInternalChannelLink = (value: string): boolean =>
  getTelegramInternalChannelId(value) !== null
