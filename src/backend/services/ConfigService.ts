import type { Config, Prisma, PrismaClient } from '@prisma/client'

import type { IChannelConfig, IConfigDto, IConfigUpdatePayload } from '@shared/types'

const DEFAULT_HISTORY_DEPTH_DAYS = 1

const normalizeList = (items?: string[]): string[] | undefined => {
  if (!items) {
    return undefined
  }

  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeChannelItem = (item: unknown): IChannelConfig | null => {
  if (typeof item === 'string') {
    const value = item.trim()

    return value ? { title: '', value } : null
  }

  if (!isRecord(item) || typeof item.value !== 'string') {
    return null
  }

  const value = item.value.trim()

  if (!value) {
    return null
  }

  return {
    title: typeof item.title === 'string' ? item.title.trim() : '',
    value
  }
}

const normalizeChannels = (items?: IChannelConfig[]): IChannelConfig[] | undefined => {
  if (!items) {
    return undefined
  }

  const channelMap = new Map<string, IChannelConfig>()

  for (const item of items) {
    const channel = normalizeChannelItem(item)

    if (channel) {
      channelMap.set(channel.value, channel)
    }
  }

  return Array.from(channelMap.values())
}

const parseChannels = (
  channelItems: Prisma.JsonValue,
  legacyChannels: string[]
): IChannelConfig[] => {
  if (Array.isArray(channelItems)) {
    const parsedChannels = channelItems
      .map(normalizeChannelItem)
      .filter((channel): channel is IChannelConfig => Boolean(channel))

    if (parsedChannels.length > 0) {
      return parsedChannels
    }
  }

  return legacyChannels.map((value) => ({ title: '', value }))
}

const toChannelItemsJson = (channels: IChannelConfig[]): Prisma.InputJsonValue =>
  channels.map((channel) => ({
    title: channel.title,
    value: channel.value
  }))

const normalizeTargetChat = (targetChat?: string): string | undefined => {
  if (targetChat === undefined) {
    return undefined
  }

  return targetChat.trim()
}

const normalizeHistoryDepth = (days?: number): number | undefined => {
  if (days === undefined) {
    return undefined
  }

  return Math.max(1, Math.min(365, Math.trunc(days)))
}

export class ConfigService {
  public constructor(private readonly db: PrismaClient) {}

  public async getConfigByTelegramId(telegramId: bigint): Promise<IConfigDto> {
    const user = await this.ensureUser(telegramId)
    const config = await this.ensureConfig(user.id)
    const session = await this.db.session.findUnique({ where: { userId: user.id } })

    return this.toDto(config, telegramId, Boolean(session?.sessionString))
  }

  public async updateConfigByTelegramId(
    telegramId: bigint,
    payload: IConfigUpdatePayload
  ): Promise<IConfigDto> {
    const user = await this.ensureUser(telegramId)
    const data = this.toUpdateData(payload)

    const config = await this.db.config.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        targetChat: data.targetChat as string | undefined,
        isActive: (data.isActive as boolean | undefined) ?? false,
        channels: (data.channels as string[] | undefined) ?? [],
        channelItems: (data.channelItems as Prisma.InputJsonValue | undefined) ?? [],
        keyWords: (data.keyWords as string[] | undefined) ?? [],
        strictMode: (data.strictMode as boolean | undefined) ?? false,
        additionalWords: (data.additionalWords as string[] | undefined) ?? [],
        banWords: (data.banWords as string[] | undefined) ?? [],
        historyDepthDays:
          (data.historyDepthDays as number | undefined) ?? DEFAULT_HISTORY_DEPTH_DAYS
      },
      update: data
    })

    const session = await this.db.session.findUnique({ where: { userId: user.id } })

    return this.toDto(config, telegramId, Boolean(session?.sessionString))
  }

  public async getUserIdByTelegramId(telegramId: bigint): Promise<string> {
    const user = await this.ensureUser(telegramId)

    return user.id
  }

  private async ensureUser(telegramId: bigint): Promise<{ id: string; telegramId: bigint }> {
    return this.db.user.upsert({
      where: { telegramId },
      create: { telegramId },
      update: {}
    })
  }

  private async ensureConfig(userId: string): Promise<Config> {
    return this.db.config.upsert({
      where: { userId },
      create: {
        userId,
        channels: [],
        keyWords: [],
        additionalWords: [],
        banWords: [],
        historyDepthDays: DEFAULT_HISTORY_DEPTH_DAYS
      },
      update: {}
    })
  }

  private toUpdateData(payload: IConfigUpdatePayload): Prisma.ConfigUpdateInput {
    const data: Prisma.ConfigUpdateInput = {}
    const targetChat = normalizeTargetChat(payload.targetChat)
    const channels = normalizeChannels(payload.channels)
    const keyWords = normalizeList(payload.keyWords)
    const additionalWords = normalizeList(payload.additionalWords)
    const banWords = normalizeList(payload.banWords)
    const historyDepthDays = normalizeHistoryDepth(payload.historyDepthDays)

    if (targetChat !== undefined) {
      data.targetChat = targetChat
    }

    if (payload.isActive !== undefined) {
      data.isActive = payload.isActive
    }

    if (channels !== undefined) {
      data.channels = channels.map((channel) => channel.value)
      data.channelItems = toChannelItemsJson(channels)
    }

    if (keyWords !== undefined) {
      data.keyWords = keyWords
    }

    if (payload.strictMode !== undefined) {
      data.strictMode = payload.strictMode
    }

    if (additionalWords !== undefined) {
      data.additionalWords = additionalWords
    }

    if (banWords !== undefined) {
      data.banWords = banWords
    }

    if (historyDepthDays !== undefined) {
      data.historyDepthDays = historyDepthDays
    }

    return data
  }

  private toDto(config: Config, telegramId: bigint, isAuthorized: boolean): IConfigDto {
    return {
      telegramId: telegramId.toString(),
      targetChat: config.targetChat ?? '',
      isActive: config.isActive,
      channels: parseChannels(config.channelItems, config.channels),
      keyWords: config.keyWords,
      strictMode: config.strictMode,
      additionalWords: config.additionalWords,
      banWords: config.banWords,
      historyDepthDays: config.historyDepthDays,
      isAuthorized,
      updatedAt: config.updatedAt.toISOString()
    }
  }
}
