export interface IForwardMessageInput {
  channelTitle: string | null
  channel: string
  dateUnixSeconds: number
  messageText: string
  keyWords: [string[], string[]?]
  postLink: string
}

const MARKDOWN_V2_SPECIAL_CHARS = /[_*[\]()~`>#+\-=|{}.!]/g

export const escapeMarkdownV2 = (value: string): string =>
  value.replace(MARKDOWN_V2_SPECIAL_CHARS, (match) => `\\${match}`)

export const formatForwardedMessage = (message: IForwardMessageInput): string => {
  const channel = escapeMarkdownV2(message.channelTitle ?? message.channel)
  const date = escapeMarkdownV2(
    new Date(message.dateUnixSeconds * 1000).toLocaleString('uk-UA')
  )
  const escapedMessageText = escapeMarkdownV2(message.messageText)
  const keyWords = escapeMarkdownV2(message.keyWords[0].join(', '))
  const additionalWords = escapeMarkdownV2(message.keyWords[1]?.join(', ') ?? '')
  const postLink = escapeMarkdownV2(message.postLink)

  return (
    `*Канал/чат:* ${channel}\n` +
    `*Дата:* ${date}\n` +
    `*Повідомлення:*\n\n` +
    escapedMessageText +
    `\n\n\n` +
    `*Ключові слова:* \n` +
    keyWords +
    '   ___   ' +
    additionalWords +
    `\n` +
    `*Посилання:* \n` +
    postLink
  )
}
