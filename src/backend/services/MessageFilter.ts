export type TMessageRejectionReason =
  | 'EMPTY_MESSAGE'
  | 'BAN_WORD'
  | 'NO_KEYWORDS'
  | 'NO_KEYWORD_MATCH'
  | 'STRICT_MISS'

export interface IMessageFilterConfig {
  keyWords: string[]
  strictMode: boolean
  additionalWords: string[]
  banWords: string[]
}

export interface IMessageFilterResult {
  accepted: boolean
  matchedKeyWords: string[]
  matchedAdditionalWords: string[]
  rejectionReason?: TMessageRejectionReason
}

const normalize = (value: string): string => value.trim().toLocaleLowerCase('uk-UA')

const cleanWords = (words: string[]): string[] => words.map(normalize).filter(Boolean)

const findMatches = (text: string, words: string[]): string[] => {
  const normalizedText = normalize(text)

  return words.filter((word) => normalizedText.includes(normalize(word)))
}

export const filterMessage = (
  messageText: string,
  config: IMessageFilterConfig
): IMessageFilterResult => {
  if (!messageText.trim()) {
    return {
      accepted: false,
      matchedKeyWords: [],
      matchedAdditionalWords: [],
      rejectionReason: 'EMPTY_MESSAGE'
    }
  }

  const banWords = cleanWords(config.banWords)
  const blockedByBanWord = findMatches(messageText, banWords).length > 0

  if (blockedByBanWord) {
    return {
      accepted: false,
      matchedKeyWords: [],
      matchedAdditionalWords: [],
      rejectionReason: 'BAN_WORD'
    }
  }

  const keyWords = cleanWords(config.keyWords)

  if (keyWords.length === 0) {
    return {
      accepted: false,
      matchedKeyWords: [],
      matchedAdditionalWords: [],
      rejectionReason: 'NO_KEYWORDS'
    }
  }

  const matchedKeyWords = findMatches(messageText, keyWords)

  if (matchedKeyWords.length === 0) {
    return {
      accepted: false,
      matchedKeyWords: [],
      matchedAdditionalWords: [],
      rejectionReason: 'NO_KEYWORD_MATCH'
    }
  }

  const additionalWords = cleanWords(config.additionalWords)
  const matchedAdditionalWords = findMatches(messageText, additionalWords)
  const strictSatisfied =
    !config.strictMode ||
    additionalWords.length === 0 ||
    matchedAdditionalWords.length === additionalWords.length

  if (!strictSatisfied) {
    return {
      accepted: false,
      matchedKeyWords,
      matchedAdditionalWords,
      rejectionReason: 'STRICT_MISS'
    }
  }

  return {
    accepted: true,
    matchedKeyWords,
    matchedAdditionalWords
  }
}
