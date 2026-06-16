import { describe, expect, test } from "bun:test";

import type { BotApiClient, IBotApiUser } from "@backend/services/BotApiClient";
import type { IMtcuteRuntimeClient } from "@backend/services/ClientManager";
import { MessageQueueWorker } from "@backend/services/MessageQueueWorker";

const createQueueItem = (targetChat: string) => ({
  id: "queue-1",
  userId: "user-1",
  messageText: "**Канал/чат:** Deals",
  status: "PENDING",
  targetChat,
  error: null,
  createdAt: new Date("2026-06-16T10:00:00.000Z"),
  updatedAt: new Date("2026-06-16T10:00:00.000Z"),
  sentAt: null,
  user: {
    telegramId: 777n,
  },
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
});
