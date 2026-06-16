import { prisma } from '@backend/db/prisma'
import { env } from '@backend/env'
import { AdminBotService } from '@backend/services/AdminBotService'
import { AdminLoginWebService } from '@backend/services/AdminLoginWebService'
import { BotApiClient } from '@backend/services/BotApiClient'
import { ClientManager } from '@backend/services/ClientManager'
import { ConfigService } from '@backend/services/ConfigService'
import { HistoricalFetcher } from '@backend/services/HistoricalFetcher'
import { MessageQueueWorker } from '@backend/services/MessageQueueWorker'
import { ScraperService } from '@backend/services/ScraperService'
import { SystemStateService } from '@backend/services/SystemStateService'

const systemStateService = new SystemStateService(prisma)
const configService = new ConfigService(prisma, systemStateService, env.joinIntervalMs)
const scraperService = new ScraperService(prisma)
const clientManager = new ClientManager(scraperService, systemStateService)
configService.setChannelJoiner(clientManager)
const historicalFetcher = new HistoricalFetcher(prisma, clientManager, scraperService)
const botApiClient = new BotApiClient(env.botToken)
const queueWorker = new MessageQueueWorker(prisma, clientManager, env.queueIntervalMs, botApiClient)
const adminLoginWebService = new AdminLoginWebService(clientManager, env.publicAppUrl)
const adminBotService = new AdminBotService(
  botApiClient,
  clientManager,
  adminLoginWebService,
  env.adminTelegramId,
  env.botPollingIntervalMs
)

export const services = {
  systemStateService,
  configService,
  scraperService,
  clientManager,
  historicalFetcher,
  queueWorker,
  botApiClient,
  adminLoginWebService,
  adminBotService
}
