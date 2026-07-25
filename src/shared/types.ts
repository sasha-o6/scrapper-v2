export type TQueueStatus = 'PENDING' | 'SENT' | 'FAILED'

export type TSystemAuthStatus =
  | 'AUTH_PENDING'
  | 'CODE_SENT'
  | 'PASSWORD_PENDING'
  | 'LOGGED_IN'

export type TChannelJoinStatus =
  | 'PENDING'
  | 'JOINED'
  | 'REQUEST_SENT'
  | 'WEBVIEW_REQUIRED'
  | 'FAILED'

export interface IChannelConfig {
  title: string
  value: string
  joinStatus?: TChannelJoinStatus
  joinError?: string
  joinedAt?: string
}

export interface IConfigDto {
  telegramId: string
  targetChat: string
  isActive: boolean
  channels: IChannelConfig[]
  keyWords: string[]
  strictMode: boolean
  additionalWords: string[]
  banWords: string[]
  historyDepthDays: number
  isAuthorized: boolean
  systemStatus: TSystemAuthStatus
  updatedAt: string
}

export interface IConfigUpdatePayload {
  targetChat?: string
  isActive?: boolean
  channels?: IChannelConfig[]
  keyWords?: string[]
  strictMode?: boolean
  additionalWords?: string[]
  banWords?: string[]
  historyDepthDays?: number
}

export interface IHistoryPayload {
  days: number
}

export interface IHistoryResultDto {
  queued: number
}

export interface IBannedSenderDto {
  id: string
  telegramId: string
  username: string | null
  name: string | null
  bannedAt: string
}

export interface IApiErrorDto {
  error: string
}
