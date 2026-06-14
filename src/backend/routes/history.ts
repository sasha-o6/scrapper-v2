import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { HistoricalFetcher } from '@backend/services/HistoricalFetcher'
import type { TAppEnv } from '@backend/types'

const HistorySchema = z
  .object({
    days: z.number().int().min(1).max(365)
  })
  .strict()

export const createHistoryRoutes = (historicalFetcher: HistoricalFetcher): Hono<TAppEnv> => {
  const route = new Hono<TAppEnv>()

  route.post('/history/collect', zValidator('json', HistorySchema), async (context) => {
    const payload = context.req.valid('json')
    const queued = await historicalFetcher.fetchForTelegramId(
      context.get('telegramId'),
      payload.days
    )

    return context.json({ queued })
  })

  return route
}
