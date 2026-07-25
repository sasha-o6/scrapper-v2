import { describe, expect, test } from "bun:test";

import type { BotApiClient, IBotApiUser } from "@backend/services/BotApiClient";
import type { IMtcuteRuntimeClient } from "@backend/services/ClientManager";
import { MessageQueueWorker } from "@backend/services/MessageQueueWorker";

const createQueueItem = (
  targetChat: string,
  overrides?: Record<string, unknown>,
) => ({
  id: "queue-1",
  userId: "user-1",
  messageText: "**Канал/чат:** Deals",
  status: "PENDING",
  targetChat,
  error: null,
  senderTelegramId: null,
  senderUsername: null,
  senderName: null,
  sentMessageId: null,
  createdAt: new Date("2026-06-16T10:00:00.000Z"),
  updatedAt: new Date("2026-06-16T10:00:00.000Z"),
  sentAt: null,
  user: {
    telegramId: 777n,
  },
  ...overrides,
});

describe("MessageQueueWorker", () => {
  test("sends to queue owner via Bot API when target chat is this bot username", async () => {
    const sentByBot: Array<{ chatId: string; text: string }> = [];
    const sentByUserbot: string[] = [];
    const updates: unknown[] = [];
    const db = {
      messageQueue: {
        findFirst: async () => createQueueItem("@scraper"),
        update: async (payload: unknown) => {
          updates.push(payload);

          return payload;
        },
      },
    };
    const clientProvider = {
      getSystemClient: async () =>
        ({
          sendText: async (chatId: string) => {
            sentByUserbot.push(chatId);
          },
        }) as unknown as IMtcuteRuntimeClient,
    };
    const botApiClient = {
      tokenBotId: "123456",
      getMe: async (): Promise<IBotApiUser> => ({
        id: 123456,
        is_bot: true,
        first_name: "Scraper",
        username: "scraper",
      }),
      sendMessage: async (chatId: string, text: string) => {
        sentByBot.push({ chatId, text });
      },
    } as unknown as BotApiClient;
    const worker = new MessageQueueWorker(
      db as never,
      clientProvider,
      1,
      botApiClient,
    );

    await worker.tick();

    expect(sentByBot).toEqual([
      {
        chatId: "777",
        text: "**Канал/чат:** Deals",
      },
    ]);
    expect(sentByUserbot).toEqual([]);
    expect(updates).toHaveLength(1);
  });

  test("keeps using central userbot for normal target chats", async () => {
    const sentByBot: Array<{ chatId: string; text: string }> = [];
    const sentByUserbot: string[] = [];
    const db = {
      messageQueue: {
        findFirst: async () => createQueueItem("@target_channel"),
        update: async (payload: unknown) => payload,
      },
    };
    const clientProvider = {
      getSystemClient: async () =>
        ({
          sendText: async (chatId: string) => {
            sentByUserbot.push(chatId);
          },
        }) as unknown as IMtcuteRuntimeClient,
    };
    const botApiClient = {
      tokenBotId: "123456",
      getMe: async (): Promise<IBotApiUser> => ({
        id: 123456,
        is_bot: true,
        first_name: "Scraper",
        username: "scraper",
      }),
      sendMessage: async (chatId: string, text: string) => {
        sentByBot.push({ chatId, text });
      },
    } as unknown as BotApiClient;
    const worker = new MessageQueueWorker(
      db as never,
      clientProvider,
      1,
      botApiClient,
    );

    await worker.tick();

    expect(sentByBot).toEqual([]);
    expect(sentByUserbot).toEqual(["@target_channel"]);
  });

  test("adds ban button and stores sent message id for bot path when sender is known", async () => {
    const sentByBot: Array<{ chatId: string; text: string; replyMarkup: unknown }> =
      [];
    const updates: Array<{ data: Record<string, unknown> }> = [];
    const db = {
      messageQueue: {
        findFirst: async () =>
          createQueueItem("@scraper", { senderTelegramId: 999n }),
        update: async (payload: { data: Record<string, unknown> }) => {
          updates.push(payload);

          return payload;
        },
      },
    };
    const clientProvider = {
      getSystemClient: async () => null,
    };
    const botApiClient = {
      tokenBotId: "123456",
      getMe: async (): Promise<IBotApiUser> => ({
        id: 123456,
        is_bot: true,
        first_name: "Scraper",
        username: "scraper",
      }),
      sendMessage: async (chatId: string, text: string, replyMarkup: unknown) => {
        sentByBot.push({ chatId, text, replyMarkup });

        return { message_id: 55, chat: { id: 777 } };
      },
    } as unknown as BotApiClient;
    const worker = new MessageQueueWorker(db as never, clientProvider, 1, botApiClient);

    await worker.tick();

    expect(sentByBot).toHaveLength(1);
    expect(sentByBot[0].replyMarkup).toEqual({
      inline_keyboard: [
        [
          {
            text: "🚫 Заблокувати користувача",
            callback_data: "ban:queue-1",
          },
        ],
      ],
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].data.sentMessageId).toBe(55n);
  });

  test("appends ban deep link for userbot path only when sender is known", async () => {
    const sentByUserbot: Array<{ chatId: string; text: unknown }> = [];
    const updates: Array<{ data: Record<string, unknown> }> = [];
    let nextItem = createQueueItem("@target_channel", { senderTelegramId: 999n });
    const db = {
      messageQueue: {
        findFirst: async () => nextItem,
        update: async (payload: { data: Record<string, unknown> }) => {
          updates.push(payload);

          return payload;
        },
      },
    };
    const clientProvider = {
      getSystemClient: async () =>
        ({
          sendText: async (chatId: string, text: unknown) => {
            sentByUserbot.push({ chatId, text });

            return { id: 91 };
          },
        }) as unknown as IMtcuteRuntimeClient,
    };
    const botApiClient = {
      tokenBotId: "123456",
      getMe: async (): Promise<IBotApiUser> => ({
        id: 123456,
        is_bot: true,
        first_name: "Scraper",
        username: "scraper",
      }),
      sendMessage: async () => undefined,
    } as unknown as BotApiClient;
    const worker = new MessageQueueWorker(db as never, clientProvider, 1, botApiClient);

    await worker.tick();

    expect(sentByUserbot).toHaveLength(1);
    expect(JSON.stringify(sentByUserbot[0].text)).toContain(
      "https://t.me/scraper?start=ban_queue-1",
    );
    expect(updates[0].data.sentMessageId).toBe(91n);

    nextItem = createQueueItem("@target_channel");
    await worker.tick();

    expect(sentByUserbot).toHaveLength(2);
    expect(JSON.stringify(sentByUserbot[1].text)).not.toContain("?start=ban_");
  });
});
