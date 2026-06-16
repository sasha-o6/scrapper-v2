import { md } from "@mtcute/markdown-parser";

export interface IForwardMessageInput {
  channelTitle: string | null;
  channel: string;
  dateUnixSeconds: number;
  messageText: string;
  keyWords: [string[], string[]?];
  postLink: string;
}

export const escapeMarkdown = (value: string): string => md.escape(value);

export const formatClickablePostLink = (value: string): string => {
  const postLink = value.trim();

  if (!postLink) {
    return "Посилання недоступне";
  }

  if (/^https?:\/\//i.test(postLink)) {
    return postLink;
  }

  if (/^(t\.me|telegram\.me)\//i.test(postLink)) {
    return `https://${postLink}`;
  }

  return postLink;
};

export const formatForwardedMessage = (
  message: IForwardMessageInput,
): string => {
  const channel = escapeMarkdown(message.channelTitle ?? message.channel);
  const date = escapeMarkdown(
    new Date(message.dateUnixSeconds * 1000).toLocaleString("uk-UA"),
  );
  const escapedMessageText = escapeMarkdown(message.messageText);
  const keyWords = escapeMarkdown(message.keyWords[0].join(", "));
  const additionalWords = escapeMarkdown(message.keyWords[1]?.join(", ") ?? "");
  const postLink = formatClickablePostLink(message.postLink);

  return (
    `📺 Канал/чат: ${channel}\n` +
    `📅 Дата: ${date}\n` +
    `📨 Повідомлення:\n\n` +
    escapedMessageText +
    `\n\n\n` +
    `🔑 Ключові слова: \n` +
    keyWords +
    "   ___   " +
    additionalWords +
    `\n` +
    `🔗 Посилання: \n` +
    postLink
  );
};
