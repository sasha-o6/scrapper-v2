import { app } from '@backend/app'
import { env } from '@backend/env'
import { services } from '@backend/services/container'
import { logger } from '@backend/utils/logger'

await services.clientManager.restoreAuthorizedClients()
services.queueWorker.start()
services.adminBotService.start()

Bun.serve({
  port: env.port,
  fetch: app.fetch
})

logger.info('Telegram monitoring app started', {
  port: env.port
})
