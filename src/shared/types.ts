export type TQueueStatus = 'PENDING' | 'SENT' | 'FAILED'

export type TAuthStep = 'phone' | 'code' | 'password' | 'authorized'

export type TAuthCodeDeliveryType =
  | 'app'
  | 'sms'
  | 'call'
  | 'flash_call'
  | 'missed_call'
  | 'email'
  | 'email_required'
  | 'fragment'
  | 'firebase'
  | 'sms_word'
  | 'sms_phrase'
  | 'success'

export type TAuthCodeNextType = Exclude<TAuthCodeDeliveryType, 'app'> | 'none'

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
  codeDelivery?: IAuthCodeDeliveryDto
}

export interface IAuthCodeDeliveryDto {
  type: TAuthCodeDeliveryType
  nextType: TAuthCodeNextType
  timeoutSeconds: number
  length: number
  beginning?: string
}

export interface ISendCodePayload {
  phone: string
}

export interface ISignInPayload {
  code: string
}

export type IResendCodePayload = Record<string, never>

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
