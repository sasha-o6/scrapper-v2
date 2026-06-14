import { prisma } from '@backend/db/prisma'
import { env } from '@backend/env'
import { ClientManager } from '@backend/services/ClientManager'
import { ConfigService } from '@backend/services/ConfigService'
import { HistoricalFetcher } from '@backend/services/HistoricalFetcher'
import { MessageQueueWorker } from '@backend/services/MessageQueueWorker'
import { ScraperService } from '@backend/services/ScraperService'

const configService = new ConfigService(prisma)
const scraperService = new ScraperService(prisma)
const clientManager = new ClientManager(prisma, scraperService)
const historicalFetcher = new HistoricalFetcher(prisma, clientManager, scraperService)
const queueWorker = new MessageQueueWorker(prisma, clientManager, env.queueIntervalMs)

export const services = {
  configService,
  scraperService,
  clientManager,
  historicalFetcher,
  queueWorker
}
