export type TQueueStatus = 'PENDING' | 'SENT' | 'FAILED'

export type TAuthStep = 'phone' | 'code' | 'password' | 'authorized'

export interface IChannelConfig {
  title: string
  value: string
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

export interface IAuthStatusDto {
  step: TAuthStep
  isAuthorized: boolean
}

export interface ISendCodePayload {
  phone: string
}

export interface ISignInPayload {
  code: string
}

export interface IPasswordPayload {
  password: string
}

export interface IHistoryPayload {
  days: number
}

export interface IHistoryResultDto {
  queued: number
}

export interface IApiErrorDto {
  error: string
}
