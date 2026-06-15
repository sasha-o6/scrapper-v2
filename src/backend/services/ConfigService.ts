import type { Config, Prisma, PrismaClient } from '@prisma/client'

import type { SystemStateService } from '@backend/services/SystemStateService'
import type {
  IChannelConfig,
  IConfigDto,
  IConfigUpdatePayload,
  TChannelJoinStatus
} from '@shared/types'

const DEFAULT_HISTORY_DEPTH_DAYS = 1
const DEFAULT_CHANNEL_JOIN_STATUS: TChannelJoinStatus = 'PENDING'

export interface IChannelJoinResult {
  status: TChannelJoinStatus
  error?: string
}

export interface IChannelJoiner {
  joinChannel(channel: string): Promise<IChannelJoinResult>
}

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

    return value ? { title: '', value, joinStatus: DEFAULT_CHANNEL_JOIN_STATUS } : null
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
    value,
    joinStatus: normalizeJoinStatus(item.joinStatus),
    joinError: typeof item.joinError === 'string' ? item.joinError : undefined,
    joinedAt: typeof item.joinedAt === 'string' ? item.joinedAt : undefined
  }
}

const normalizeJoinStatus = (value: unknown): TChannelJoinStatus => {
  if (
    value === 'PENDING' ||
    value === 'JOINED' ||
    value === 'REQUEST_SENT' ||
    value === 'WEBVIEW_REQUIRED' ||
    value === 'FAILED'
  ) {
    return value
  }

  return DEFAULT_CHANNEL_JOIN_STATUS
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
  channels.map((channel) => {
    const item: Prisma.JsonObject = {
      title: channel.title,
      value: channel.value,
      joinStatus: channel.joinStatus ?? DEFAULT_CHANNEL_JOIN_STATUS
    }

    if (channel.joinError) {
      item.joinError = channel.joinError
    }

    if (channel.joinedAt) {
      item.joinedAt = channel.joinedAt
    }

    return item
  })

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
  private channelJoiner: IChannelJoiner | null = null

  public constructor(
    private readonly db: PrismaClient,
    private readonly systemStateService: SystemStateService
  ) {}

  public setChannelJoiner(channelJoiner: IChannelJoiner): void {
    this.channelJoiner = channelJoiner
  }

  public async getConfigByTelegramId(telegramId: bigint): Promise<IConfigDto> {
    const user = await this.ensureUser(telegramId)
    const config = await this.ensureConfig(user.id)
    const systemStatus = await this.systemStateService.getStatus()

    return this.toDto(config, telegramId, systemStatus)
  }

  public async updateConfigByTelegramId(
    telegramId: bigint,
    payload: IConfigUpdatePayload
  ): Promise<IConfigDto> {
    const user = await this.ensureUser(telegramId)
    const currentConfig = await this.ensureConfig(user.id)
    const data = await this.toUpdateData(payload, currentConfig)

    const config = await this.db.config.update({
      where: { userId: user.id },
      data
    })
    const systemStatus = await this.systemStateService.getStatus()

    return this.toDto(config, telegramId, systemStatus)
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

  private async toUpdateData(
    payload: IConfigUpdatePayload,
    currentConfig: Config
  ): Promise<Prisma.ConfigUpdateInput> {
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
      const channelsWithJoinResults = await this.attachJoinResults(channels, currentConfig)
      data.channels = channelsWithJoinResults.map((channel) => channel.value)
      data.channelItems = toChannelItemsJson(channelsWithJoinResults)
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

  private async attachJoinResults(
    channels: IChannelConfig[],
    currentConfig: Config
  ): Promise<IChannelConfig[]> {
    const existingChannels = parseChannels(currentConfig.channelItems, currentConfig.channels)
    const existingByValue = new Map(
      existingChannels.map((channel) => [channel.value, channel] as const)
    )
    const now = new Date().toISOString()
    const nextChannels: IChannelConfig[] = []

    for (const channel of channels) {
      const existingChannel = existingByValue.get(channel.value)

      if (existingChannel) {
        nextChannels.push({
          ...existingChannel,
          title: channel.title
        })
        continue
      }

      if (!this.channelJoiner) {
        nextChannels.push({
          ...channel,
          joinStatus: 'FAILED',
          joinError: 'Channel joiner is not available'
        })
        continue
      }

      const joinResult = await this.channelJoiner.joinChannel(channel.value)

      nextChannels.push({
        ...channel,
        joinStatus: joinResult.status,
        joinError: joinResult.error,
        joinedAt: joinResult.status === 'JOINED' ? now : undefined
      })
    }

    return nextChannels
  }

  private toDto(
    config: Config,
    telegramId: bigint,
    systemStatus: IConfigDto['systemStatus']
  ): IConfigDto {
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
      isAuthorized: systemStatus === 'LOGGED_IN',
      systemStatus,
      updatedAt: config.updatedAt.toISOString()
    }
  }
}
