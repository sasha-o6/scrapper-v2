import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { ConfigService } from '@backend/services/ConfigService'
import type { TAppEnv } from '@backend/types'

const ConfigUpdateSchema = z
  .object({
    targetChat: z.string().max(120).optional(),
    isActive: z.boolean().optional(),
    channels: z
      .array(
        z
          .object({
            title: z.string().max(120).optional().default(''),
            value: z.string().min(1).max(200)
          })
          .strict()
      )
      .max(100)
      .optional(),
    keyWords: z.array(z.string().min(1).max(100)).max(200).optional(),
    strictMode: z.boolean().optional(),
    additionalWords: z.array(z.string().min(1).max(100)).max(200).optional(),
    banWords: z.array(z.string().min(1).max(100)).max(200).optional(),
    historyDepthDays: z.number().int().min(1).max(365).optional()
  })
  .strict()

export const createConfigRoutes = (configService: ConfigService): Hono<TAppEnv> => {
  const route = new Hono<TAppEnv>()

  route.get('/config', async (context) => {
    const config = await configService.getConfigByTelegramId(context.get('telegramId'))

    return context.json(config)
  })

  route.put('/config', zValidator('json', ConfigUpdateSchema), async (context) => {
    const payload = context.req.valid('json')
    const config = await configService.updateConfigByTelegramId(
      context.get('telegramId'),
      payload
    )

    return context.json(config)
  })

  return route
}
