import { TelegramClient, type InputText } from '@mtcute/bun'
import { Dispatcher } from '@mtcute/dispatcher'
import type { PrismaClient } from '@prisma/client'

import { env } from '@backend/env'
import { ConfigService } from '@backend/services/ConfigService'
import {
  DatabaseSessionStorageAdapter,
  type IMtcuteSessionClient
} from '@backend/services/DatabaseSessionStorageAdapter'
import type { ScraperService } from '@backend/services/ScraperService'
import { logger } from '@backend/utils/logger'
import type {
  IAuthCodeDeliveryDto,
  IAuthStatusDto,
  TAuthCodeDeliveryType,
  TAuthCodeNextType,
  TAuthStep
} from '@shared/types'

interface IMtcuteSentCodeResult {
  phoneCodeHash: string
  type: TAuthCodeDeliveryType
  nextType: TAuthCodeNextType
  timeout: number
  length: number
  beginning?: string
}

type TMtcuteSendCodeResult = IMtcuteSentCodeResult | unknown

interface IMtcuteRuntimeClient extends IMtcuteSessionClient {
  sendCode(payload: { phone: string }): Promise<TMtcuteSendCodeResult>
  resendCode(payload: {
    phone: string
    phoneCodeHash: string
  }): Promise<IMtcuteSentCodeResult>
  signIn(payload: {
    phone: string
    phoneCodeHash: string
    phoneCode: string
  }): Promise<unknown>
  checkPassword(password: string): Promise<unknown>
  getMe(): Promise<unknown>
  startUpdatesLoop(): void
  sendText(chatId: string, text: InputText): Promise<unknown>
  openChat?(chatId: string): Promise<unknown>
  getHistory?(
    chatId: string,
    options: { limit: number; offset?: { id: number; date: number } }
  ): Promise<unknown[]>
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

const isRpcError = (error: unknown, code: string): boolean => {
  if (!(error instanceof Error)) {
    return false
  }

  return error.message.includes(code) || error.name.includes(code)
}

const isSentCodeResult = (result: unknown): result is IMtcuteSentCodeResult => {
  if (typeof result !== 'object' || result === null) {
    return false
  }

  return typeof (result as { phoneCodeHash?: unknown }).phoneCodeHash === 'string'
}

const TelegramClientCtor = TelegramClient as unknown as ITelegramClientConstructor
const DispatcherFactory = Dispatcher as unknown as IDispatcherFactory

export class ClientManager {
  private readonly clients = new Map<string, IMtcuteRuntimeClient>()

  private readonly pendingClients = new Map<string, IMtcuteRuntimeClient>()

  private readonly dispatchers = new Map<string, IDispatcher>()

  private readonly configService: ConfigService

  private readonly sessionStorage: DatabaseSessionStorageAdapter

  public constructor(
    private readonly db: PrismaClient,
    private readonly scraperService: ScraperService
  ) {
    this.configService = new ConfigService(db)
    this.sessionStorage = new DatabaseSessionStorageAdapter(db)
  }

  public async restoreAuthorizedClients(): Promise<void> {
    const sessions = await this.db.session.findMany({
      where: {
        sessionString: {
          not: null
        }
      }
    })

    await Promise.all(
      sessions.map(async (session) => {
        try {
          const client = this.createClient()
          await this.sessionStorage.importForUser(session.userId, client)
          await client.getMe()
          client.startUpdatesLoop()
          this.clients.set(session.userId, client)
          this.attachMessageListener(session.userId, client)
        } catch (error) {
          logger.warn('Failed to restore Telegram client', {
            userId: session.userId,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      })
    )
  }

  public async getAuthStatus(telegramId: bigint): Promise<IAuthStatusDto> {
    const userId = await this.configService.getUserIdByTelegramId(telegramId)
    const session = await this.db.session.findUnique({ where: { userId } })
    const isAuthorized = Boolean(session?.sessionString)

    return {
      step: isAuthorized ? 'authorized' : this.getPendingStep(userId),
      isAuthorized
    }
  }

  public async sendCode(telegramId: bigint, phone: string): Promise<IAuthStatusDto> {
    const userId = await this.configService.getUserIdByTelegramId(telegramId)
    const client = await this.preparePendingClient(userId)
    const result = await client.sendCode({ phone })

    if (!isSentCodeResult(result)) {
      await this.promoteAuthorizedClient(userId, client)

      return {
        step: 'authorized',
        isAuthorized: true
      }
    }

    await this.db.session.upsert({
      where: { userId },
      create: {
        userId,
        phone,
        phoneCodeHash: result.phoneCodeHash
      },
      update: {
        phone,
        phoneCodeHash: result.phoneCodeHash
      }
    })

    const codeDelivery = this.toCodeDelivery(result)
    this.logCodeDelivery(userId, 'requested', codeDelivery)

    return {
      step: 'code',
      isAuthorized: false,
      codeDelivery
    }
  }

  public async resendCode(telegramId: bigint): Promise<IAuthStatusDto> {
    const userId = await this.configService.getUserIdByTelegramId(telegramId)
    const session = await this.db.session.findUnique({ where: { userId } })

    if (!session?.phone || !session.phoneCodeHash) {
      throw new Error('Phone code was not requested')
    }

    const client = await this.preparePendingClient(userId)
    const result = await client.resendCode({
      phone: session.phone,
      phoneCodeHash: session.phoneCodeHash
    })

    await this.db.session.update({
      where: { userId },
      data: {
        phoneCodeHash: result.phoneCodeHash
      }
    })

    const codeDelivery = this.toCodeDelivery(result)
    this.logCodeDelivery(userId, 'resent', codeDelivery)

    return {
      step: 'code',
      isAuthorized: false,
      codeDelivery
    }
  }

  public async signIn(telegramId: bigint, code: string): Promise<IAuthStatusDto> {
    const userId = await this.configService.getUserIdByTelegramId(telegramId)
    const session = await this.db.session.findUnique({ where: { userId } })

    if (!session?.phone || !session.phoneCodeHash) {
      throw new Error('Phone code was not requested')
    }

    const client = await this.preparePendingClient(userId)

    try {
      await client.signIn({
        phone: session.phone,
        phoneCodeHash: session.phoneCodeHash,
        phoneCode: code
      })
    } catch (error) {
      if (isRpcError(error, 'SESSION_PASSWORD_NEEDED')) {
        return {
          step: 'password',
          isAuthorized: false
        }
      }

      throw error
    }

    await this.promoteAuthorizedClient(userId, client)

    return {
      step: 'authorized',
      isAuthorized: true
    }
  }

  public async checkPassword(telegramId: bigint, password: string): Promise<IAuthStatusDto> {
    const userId = await this.configService.getUserIdByTelegramId(telegramId)
    const client = await this.preparePendingClient(userId)
    await client.checkPassword(password)
    await this.promoteAuthorizedClient(userId, client)

    return {
      step: 'authorized',
      isAuthorized: true
    }
  }

  public async getClientForUserId(userId: string): Promise<IMtcuteRuntimeClient | null> {
    const cachedClient = this.clients.get(userId)

    if (cachedClient) {
      return cachedClient
    }

    const session = await this.db.session.findUnique({ where: { userId } })

    if (!session?.sessionString) {
      return null
    }

    const client = this.createClient()
    await this.sessionStorage.importForUser(userId, client)
    await client.getMe()
    client.startUpdatesLoop()
    this.clients.set(userId, client)
    this.attachMessageListener(userId, client)

    return client
  }

  public async getClientForTelegramId(telegramId: bigint): Promise<IMtcuteRuntimeClient | null> {
    const userId = await this.configService.getUserIdByTelegramId(telegramId)

    return this.getClientForUserId(userId)
  }

  private getPendingStep(userId: string): TAuthStep {
    return this.pendingClients.has(userId) ? 'code' : 'phone'
  }

  private async preparePendingClient(userId: string): Promise<IMtcuteRuntimeClient> {
    const existingClient = this.pendingClients.get(userId)

    if (existingClient) {
      return existingClient
    }

    const client = this.createClient()
    await this.sessionStorage.importForUser(userId, client)
    this.pendingClients.set(userId, client)

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

  private toCodeDelivery(result: IMtcuteSentCodeResult): IAuthCodeDeliveryDto {
    return {
      type: result.type,
      nextType: result.nextType,
      timeoutSeconds: result.timeout,
      length: result.length,
      beginning: result.beginning
    }
  }

  private logCodeDelivery(
    userId: string,
    action: 'requested' | 'resent',
    codeDelivery: IAuthCodeDeliveryDto
  ): void {
    logger.info(`Telegram auth code ${action}`, {
      userId,
      deliveryType: codeDelivery.type,
      nextType: codeDelivery.nextType,
      timeoutSeconds: codeDelivery.timeoutSeconds,
      codeLength: codeDelivery.length
    })
  }

  private async promoteAuthorizedClient(
    userId: string,
    client: IMtcuteRuntimeClient
  ): Promise<void> {
    await this.sessionStorage.persistForUser(userId, client)
    client.startUpdatesLoop()
    this.clients.set(userId, client)
    this.pendingClients.delete(userId)
    this.attachMessageListener(userId, client)
  }

  private attachMessageListener(userId: string, client: IMtcuteRuntimeClient): void {
    if (this.dispatchers.has(userId)) {
      return
    }

    const dispatcher = DispatcherFactory.for(client)
    dispatcher.onNewMessage((message) => {
      void this.scraperService.handleIncomingMessage(userId, message).catch((error) => {
        logger.error('Failed to process realtime Telegram message', {
          userId,
          error: error instanceof Error ? error.message : String(error)
        })
      })
    })
    this.dispatchers.set(userId, dispatcher)
  }
}

export type { IMtcuteRuntimeClient }
