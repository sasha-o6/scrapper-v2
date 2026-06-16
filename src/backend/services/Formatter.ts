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

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

export const formatClickablePostLink = (value: string): string => {
  const postLink = value.trim();

  if (!postLink) {
    return "-";
  }

  if (/^https?:\/\//i.test(postLink)) {
    return postLink;
  }

  if (/^(t\.me|telegram\.me)\//i.test(postLink)) {
    return `https://${postLink}`;
  }

  return postLink;
};

export const formatChannelLink = (value: string): string => {
  const channelRef = value.trim();

  if (!channelRef) {
    return "";
  }

  if (/^https?:\/\//i.test(channelRef)) {
    return channelRef;
  }

  if (/^(t\.me|telegram\.me)\//i.test(channelRef)) {
    return `https://${channelRef}`;
  }

  if (/^@[a-z0-9_]{5,}$/i.test(channelRef)) {
    return `https://t.me/${channelRef.slice(1)}`;
  }

  return "";
};

export const getChannelLinkFromPostLink = (value: string): string => {
  const postLink = formatChannelLink(value);

  if (!postLink) {
    return "";
  }

  try {
    const url = new URL(postLink);
    const segments = trimSlashes(url.pathname).split("/").filter(Boolean);

    if (segments.length <= 1) {
      return url.toString();
    }

    const channelPath =
      segments[0] === "c" && segments[1] ? ["c", segments[1]] : [segments[0]];

    url.pathname = `/${channelPath.join("/")}`;
    url.search = "";
    url.hash = "";

    return url.toString();
  } catch {
    return "";
  }
};

const formatChannelTitle = (channel: string, link: string): string => {
  const escapedChannel = escapeMarkdown(channel);

  if (!link) {
    return escapedChannel;
  }

  return `[${escapedChannel}](${link})`;
};

export const formatForwardedMessage = (
  message: IForwardMessageInput,
): string => {
  const rawChannel = message.channelTitle ?? message.channel;
  const channelLink =
    getChannelLinkFromPostLink(message.postLink) ||
    formatChannelLink(message.channel);
  const channel = formatChannelTitle(rawChannel, channelLink);
  const date = escapeMarkdown(
    new Date(message.dateUnixSeconds * 1000).toLocaleString("uk-UA"),
  );
  const escapedMessageText = escapeMarkdown(message.messageText);
  const keyWords = escapeMarkdown(message.keyWords[0].join(", "));
  const additionalWords = escapeMarkdown(
    "   ___   " + (message.keyWords[1]?.join(", ") ?? ""),
  );
  const postLink = formatClickablePostLink(message.postLink);

  return (
    `📺 Канал/чат: ${channel}\n` +
    `📅 Дата: ${date}\n` +
    `✉️ Повідомлення:\n\n` +
    escapedMessageText +
    `\n\n\n` +
    `🔑 Ключові слова: \n` +
    keyWords +
    additionalWords +
    `\n` +
    `🔗 Посилання: \n` +
    postLink
  );
};
