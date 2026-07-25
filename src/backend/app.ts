import { serveStatic } from 'hono/bun'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { createAuthMiddleware } from '@backend/middleware/auth'
import { createAdminLoginRoutes } from '@backend/routes/adminLogin'
import { createBannedSenderRoutes } from '@backend/routes/bannedSenders'
import { createConfigRoutes } from '@backend/routes/config'
import { createHistoryRoutes } from '@backend/routes/history'
import { services } from '@backend/services/container'
import type { TAppEnv } from '@backend/types'
import { logger } from '@backend/utils/logger'

export const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    allowHeaders: ['content-type', 'authorization', 'x-telegram-init-data'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
)

app.get('/api/health', (context) =>
  context.json({
    ok: true
  })
)

const protectedApi = new Hono<TAppEnv>()
protectedApi.use('*', createAuthMiddleware(services.configService))
protectedApi.route('/', createConfigRoutes(services.configService))
protectedApi.route('/', createHistoryRoutes(services.historicalFetcher))
protectedApi.route('/', createBannedSenderRoutes(services.senderBanService))

app.route('/api', protectedApi)
app.route('/', createAdminLoginRoutes(services.adminLoginWebService))

app.get('/assets/*', serveStatic({ root: './dist/client' }))
app.get('/favicon.ico', serveStatic({ path: './dist/client/favicon.ico' }))
app.get('*', serveStatic({ path: './dist/client/index.html' }))

app.onError((error, context) => {
  logger.error('Unhandled API error', {
    path: context.req.path,
    error: error.message
  })

  return context.json({ error: error.message }, 500)
})

app.notFound((context) => context.json({ error: 'Not found' }, 404))
