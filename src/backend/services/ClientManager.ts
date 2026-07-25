import { TelegramClient, type InputText } from '@mtcute/bun'
import { Dispatcher } from '@mtcute/dispatcher'

import { env } from '@backend/env'
import type { IChannelJoinResult } from '@backend/services/ConfigService'
import type { ScraperService } from '@backend/services/ScraperService'
import { SystemSessionStorageAdapter } from '@backend/services/SystemSessionStorageAdapter'
import type { IMtcuteSessionClient } from '@backend/services/SystemSessionStorageAdapter'
import type { SystemStateService } from '@backend/services/SystemStateService'
import {
  getMtcutePeerCandidates,
  getPrimaryMtcutePeerInput,
  isNumericTelegramRef,
  isTelegramInternalChannelLink,
  type TTelegramPeerInput
} from '@backend/services/TelegramPeerRef'
import { logger } from '@backend/utils/logger'
import type { TSystemAuthStatus } from '@shared/types'

type TAuthCodeDeliveryType =
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

type TAuthCodeNextType = Exclude<TAuthCodeDeliveryType, 'app'> | 'none'

type TAdminAuthStep = 'code' | 'password' | 'authorized'

interface IAuthCodeDeliveryDto {
  type: TAuthCodeDeliveryType
  nextType: TAuthCodeNextType
  timeoutSeconds: number
  length: number
  beginning?: string
}

export interface IAdminAuthResult {
  step: TAdminAuthStep
  codeDelivery?: IAuthCodeDeliveryDto
}

interface IMtcuteSentCodeResult {
  phoneCodeHash: string
  type: TAuthCodeDeliveryType
  nextType: TAuthCodeNextType
  timeout: number
  length: number
  beginning?: string
}

type TMtcuteSendCodeResult = IMtcuteSentCodeResult | unknown

interface IMtcuteJoinChatResult {
  status: 'ok' | 'request_sent' | 'webview'
}

interface IMtcuteRuntimeClient extends IMtcuteSessionClient {
  sendCode(payload: { phone: string }): Promise<TMtcuteSendCodeResult>
  signIn(payload: {
    phone: string
    phoneCodeHash: string
    phoneCode: string
  }): Promise<unknown>
  checkPassword(password: string): Promise<unknown>
  getMe(): Promise<unknown>
  startUpdatesLoop(): void
  sendText(chatId: TTelegramPeerInput, text: InputText): Promise<unknown>
  joinChat(chatId: TTelegramPeerInput): Promise<IMtcuteJoinChatResult>
  getChat?(chatId: TTelegramPeerInput): Promise<unknown>
  openChat?(chatId: TTelegramPeerInput): Promise<unknown>
  getHistory?(
    chatId: TTelegramPeerInput,
    options: { limit: number; offset?: { id: number; date: number } }
  ): Promise<unknown[]>
  editMessage?(params: {
    chatId: TTelegramPeerInput
    message: number
    text: InputText
  }): Promise<unknown>
}

interface ITelegramClientConstructor {
  new (options: {
    apiId: number
    apiHash: string
    updates?: {
      catchUp?: boolean
      messageGroupingInterval?: number
    }
  }): IMtcuteRuntimeClient
}

interface IDispatcher {
  onNewMessage(handler: (message: unknown) => void | Promise<void>): void
}

interface IDispatcherFactory {
  for(client: unknown): IDispatcher
}

const TelegramClientCtor = TelegramClient as unknown as ITelegramClientConstructor
const DispatcherFactory = Dispatcher as unknown as IDispatcherFactory

const isSentCodeResult = (result: unknown): result is IMtcuteSentCodeResult => {
  if (typeof result !== 'object' || result === null) {
    return false
  }

  return typeof (result as { phoneCodeHash?: unknown }).phoneCodeHash === 'string'
}

const getErrorText = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`
  }

  return String(error)
}

const hasRpcCode = (error: unknown, code: string): boolean =>
  getErrorText(error).toLocaleUpperCase('en-US').includes(code)

const getFloodWaitSeconds = (error: unknown): number | null => {
  const text = getErrorText(error)
  const match = text.match(/FLOOD_WAIT_?(\d+)?/i)

  if (match?.[1]) {
    return Number(match[1])
  }

  if (typeof error === 'object' && error !== null) {
    const seconds = (error as { seconds?: unknown }).seconds

    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return seconds
    }
  }

  return null
}

const isPrivateInviteLink = (value: string): boolean => {
  const normalizedValue = value.trim().toLocaleLowerCase('en-US')

  return (
    /^(https?:\/\/)?(t\.me|telegram\.me)\/\+/.test(normalizedValue) ||
    /^(https?:\/\/)?(t\.me|telegram\.me)\/joinchat\//.test(normalizedValue)
  )
}

const shouldCheckExistingChatAccess = (value: string): boolean =>
  isNumericTelegramRef(value) || isPrivateInviteLink(value) || isTelegramInternalChannelLink(value)

export class ClientManager {
  private client: IMtcuteRuntimeClient | null = null

  private pendingClient: IMtcuteRuntimeClient | null = null

  private dispatcher: IDispatcher | null = null

  private readonly sessionStorage: SystemSessionStorageAdapter

  public constructor(
    private readonly scraperService: ScraperService,
    private readonly systemStateService: SystemStateService
  ) {
    this.sessionStorage = new SystemSessionStorageAdapter(systemStateService)
  }

  public async restoreAuthorizedClients(): Promise<void> {
    const state = await this.systemStateService.ensureState()

    if (!state.sessionString) {
      await this.systemStateService.update({ authStatus: 'AUTH_PENDING' })

      return
    }

    try {
      const client = this.createClient()
      await client.importSession(state.sessionString)
      await this.activateClient(client)
      await this.systemStateService.update({ authStatus: 'LOGGED_IN' })
    } catch (error) {
      this.client = null
      this.dispatcher = null
      await this.systemStateService.update({ authStatus: 'AUTH_PENDING' })
      logger.warn('Failed to restore central Telegram userbot', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  public async getSystemClient(): Promise<IMtcuteRuntimeClient | null> {
    if (this.client) {
      return this.client
    }

    const state = await this.systemStateService.ensureState()

    if (!state.sessionString) {
      return null
    }

    const client = this.createClient()
    await client.importSession(state.sessionString)
    await this.activateClient(client)
    await this.systemStateService.update({ authStatus: 'LOGGED_IN' })

    return client
  }

  public async isAuthorized(): Promise<boolean> {
    return this.systemStateService.isLoggedIn()
  }

  public async getAuthStatus(): Promise<TSystemAuthStatus> {
    return this.systemStateService.getStatus()
  }

  public async sendCodeToAdmin(): Promise<IAdminAuthResult> {
    const client = await this.preparePendingClient()
    const result = await client.sendCode({ phone: env.adminPhone })

    if (!isSentCodeResult(result)) {
      await this.promoteAuthorizedClient(client)

      return {
        step: 'authorized'
      }
    }

    await this.systemStateService.update({
      phone: env.adminPhone,
      phoneCodeHash: result.phoneCodeHash,
      authStatus: 'CODE_SENT'
    })

    this.logCodeDelivery(result)

    return {
      step: 'code',
      codeDelivery: this.toCodeDelivery(result)
    }
  }

  public async signInWithCode(code: string): Promise<IAdminAuthResult> {
    const state = await this.systemStateService.ensureState()

    if (!state.phone || !state.phoneCodeHash) {
      throw new Error('Phone code was not requested')
    }

    const client = await this.preparePendingClient()

    try {
      await client.signIn({
        phone: state.phone,
        phoneCodeHash: state.phoneCodeHash,
        phoneCode: code
      })
    } catch (error) {
      if (hasRpcCode(error, 'SESSION_PASSWORD_NEEDED')) {
        await this.systemStateService.update({ authStatus: 'PASSWORD_PENDING' })

        return {
          step: 'password'
        }
      }

      throw error
    }

    await this.promoteAuthorizedClient(client)

    return {
      step: 'authorized'
    }
  }

  public async checkPassword(password: string): Promise<IAdminAuthResult> {
    const client = await this.preparePendingClient()
    await client.checkPassword(password)
    await this.promoteAuthorizedClient(client)

    return {
      step: 'authorized'
    }
  }

  public async resetPendingAuthAttempt(): Promise<void> {
    this.pendingClient = null
    await this.systemStateService.update({
      authStatus: 'AUTH_PENDING',
      phoneCodeHash: null
    })
  }

  public async joinChannel(channel: string): Promise<IChannelJoinResult> {
    let client: IMtcuteRuntimeClient | null = null

    try {
      client = await this.getSystemClient()
    } catch (error) {
      return this.toJoinError(error)
    }

    if (!client) {
      return {
        status: 'PENDING',
        error: 'Central userbot is not authorized. Admin must send /login to the bot.'
      }
    }

    const peerCandidates = getMtcutePeerCandidates(channel)
    const primaryPeerInput = getPrimaryMtcutePeerInput(channel)

    if (
      shouldCheckExistingChatAccess(channel) &&
      (await this.hasChatAccess(client, peerCandidates))
    ) {
      return {
        status: 'JOINED'
      }
    }

    try {
      const result = await client.joinChat(primaryPeerInput)

      if (result.status === 'request_sent') {
        return {
          status: 'REQUEST_SENT',
          error: 'Join request was sent and is waiting for channel admin approval'
        }
      }

      if (result.status === 'webview') {
        return {
          status: 'WEBVIEW_REQUIRED',
          error: 'Telegram requested a webview guard before joining this channel'
        }
      }

      return {
        status: 'JOINED'
      }
    } catch (error) {
      if (
        hasRpcCode(error, 'CHANNEL_PRIVATE') &&
        (await this.hasChatAccess(client, peerCandidates))
      ) {
        return {
          status: 'JOINED'
        }
      }

      return this.toJoinError(error)
    }
  }

  public async editSystemMessageText(
    targetChat: string,
    messageId: number,
    text: InputText
  ): Promise<boolean> {
    let client: IMtcuteRuntimeClient | null = null

    try {
      client = await this.getSystemClient()
    } catch (error) {
      logger.warn('Failed to get system client for message edit', {
        error: getErrorText(error)
      })

      return false
    }

    if (!client?.editMessage) {
      return false
    }

    try {
      await client.editMessage({
        chatId: getPrimaryMtcutePeerInput(targetChat),
        message: messageId,
        text
      })

      return true
    } catch (error) {
      logger.warn('Failed to edit userbot message', {
        targetChat,
        messageId,
        error: getErrorText(error)
      })

      return false
    }
  }

  private async preparePendingClient(): Promise<IMtcuteRuntimeClient> {
    if (this.pendingClient) {
      return this.pendingClient
    }

    const client = this.createClient()
    await this.sessionStorage.import(client)
    this.pendingClient = client

    return client
  }

  private createClient(): IMtcuteRuntimeClient {
    return new TelegramClientCtor({
      apiId: env.telegramApiId,
      apiHash: env.telegramApiHash,
      updates: {
        catchUp: true,
        messageGroupingInterval: 250
      }
    })
  }

  private async promoteAuthorizedClient(client: IMtcuteRuntimeClient): Promise<void> {
    await this.sessionStorage.persist(client)
    await this.activateClient(client)
    this.pendingClient = null
  }

  private async activateClient(client: IMtcuteRuntimeClient): Promise<void> {
    await client.getMe()
    client.startUpdatesLoop()
    this.client = client
    this.attachMessageListener(client)
  }

  private attachMessageListener(client: IMtcuteRuntimeClient): void {
    if (this.dispatcher) {
      return
    }

    const dispatcher = DispatcherFactory.for(client)
    dispatcher.onNewMessage((message) => {
      void this.scraperService.handleIncomingMessage(message).catch((error) => {
        logger.error('Failed to process realtime Telegram message', {
          error: error instanceof Error ? error.message : String(error)
        })
      })
    })
    this.dispatcher = dispatcher
  }

  private async hasChatAccess(
    client: IMtcuteRuntimeClient,
    peerCandidates: TTelegramPeerInput[]
  ): Promise<boolean> {
    for (const peerCandidate of peerCandidates) {
      if (client.getChat) {
        try {
          await client.getChat(peerCandidate)

          return true
        } catch {
          continue
        }
      }

      if (client.openChat) {
        try {
          await client.openChat(peerCandidate)

          return true
        } catch {
          continue
        }
      }
    }

    return false
  }

  private toCodeDelivery(result: IMtcuteSentCodeResult): IAuthCodeDeliveryDto {
    return {
      type: result.type,
      nextType: result.nextType,
      timeoutSeconds: result.timeout,
      length: result.length,
      beginning: result.beginning
    }
  }

  private logCodeDelivery(codeDelivery: IMtcuteSentCodeResult): void {
    logger.info('Telegram auth code requested for central userbot', {
      deliveryType: codeDelivery.type,
      nextType: codeDelivery.nextType,
      timeoutSeconds: codeDelivery.timeout,
      codeLength: codeDelivery.length
    })
  }

  private toJoinError(error: unknown): IChannelJoinResult {
    const floodWaitSeconds = getFloodWaitSeconds(error)

    if (floodWaitSeconds !== null) {
      return {
        status: 'FAILED',
        error: `Telegram FLOOD_WAIT: retry after ${floodWaitSeconds} seconds`
      }
    }

    if (hasRpcCode(error, 'INVITE_HASH_EXPIRED')) {
      return {
        status: 'FAILED',
        error: 'Invite link expired'
      }
    }

    if (hasRpcCode(error, 'CHANNEL_PRIVATE')) {
      return {
        status: 'FAILED',
        error: 'Channel is private or unavailable to the central userbot'
      }
    }

    return {
      status: 'FAILED',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export type { IMtcuteRuntimeClient }
