import { createMiddleware } from 'hono/factory'

import { env } from '@backend/env'
import type { ConfigService } from '@backend/services/ConfigService'
import type { TAppEnv } from '@backend/types'
import { verifyTelegramInitData } from '@backend/utils/telegramInitData'

const extractInitData = (authorization: string | undefined, header: string | undefined): string | null => {
  if (header) {
    return header
  }

  if (!authorization) {
    return null
  }

  const [scheme, ...rest] = authorization.split(' ')

  if (scheme.toLocaleLowerCase() !== 'tma' || rest.length === 0) {
    return null
  }

  return rest.join(' ')
}

export const createAuthMiddleware = (configService: ConfigService) =>
  createMiddleware<TAppEnv>(async (context, next) => {
    const initData = extractInitData(
      context.req.header('authorization'),
      context.req.header('x-telegram-init-data')
    )

    if (!initData) {
      if (env.allowDevAuth && env.devTelegramId) {
        const userId = await configService.getUserIdByTelegramId(env.devTelegramId)
        context.set('telegramId', env.devTelegramId)
        context.set('userId', userId)
        await next()

        return
      }

      return context.json({ error: 'Telegram initData header is required' }, 401)
    }

    try {
      const verified = verifyTelegramInitData(initData, env.botToken)
      const userId = await configService.getUserIdByTelegramId(verified.userId)
      context.set('telegramId', verified.userId)
      context.set('userId', userId)
      await next()
    } catch (error) {
      return context.json(
        {
          error: error instanceof Error ? error.message : 'Telegram initData is invalid'
        },
        401
      )
    }
  })
