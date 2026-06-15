import type { INormalizedTelegramMessage } from '@backend/services/TelegramMessageNormalizer'

const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'])

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '')

const normalizeToken = (value: string): string =>
  trimSlashes(value.trim())
    .replace(/^@/, '')
    .toLocaleLowerCase('uk-UA')

const normalizeNumericRef = (value: string): string => {
  if (/^-100\d+$/.test(value)) {
    return value.slice(4)
  }

  return value
}

const extractTelegramPath = (value: string): string | null => {
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`)

    if (!TELEGRAM_HOSTS.has(url.hostname.toLocaleLowerCase('uk-UA'))) {
      return null
    }

    return trimSlashes(url.pathname)
  } catch {
    return null
  }
}

export const normalizeChannelRef = (value: string): string => {
  const trimmedValue = value.trim()
  const telegramPath = extractTelegramPath(trimmedValue)

  if (!telegramPath) {
    return normalizeNumericRef(normalizeToken(trimmedValue))
  }

  const [firstSegment, secondSegment] = telegramPath.split('/')

  if (firstSegment === 'joinchat' || firstSegment === '+') {
    return normalizeToken(secondSegment ?? telegramPath)
  }

  if (firstSegment === 'c' && secondSegment) {
    return normalizeNumericRef(normalizeToken(secondSegment))
  }

  return normalizeNumericRef(normalizeToken(firstSegment))
}

export const getMessageChannelRefs = (
  message: INormalizedTelegramMessage
): Set<string> => {
  const refs = [
    message.channelId,
    message.channel,
    message.channelTitle ?? '',
    message.channelUsername ?? ''
  ]

  return new Set(refs.map(normalizeChannelRef).filter(Boolean))
}

export const isMessageFromConfiguredChannel = (
  message: INormalizedTelegramMessage,
  configuredChannel: string
): boolean => getMessageChannelRefs(message).has(normalizeChannelRef(configuredChannel))
