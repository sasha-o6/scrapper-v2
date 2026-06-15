import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { ClientManager } from '@backend/services/ClientManager'
import type { TAppEnv } from '@backend/types'

const SendCodeSchema = z
  .object({
    phone: z.string().min(5).max(32)
  })
  .strict()

const SignInSchema = z
  .object({
    code: z.string().min(2).max(16)
  })
  .strict()

const ResendCodeSchema = z.object({}).strict()

const PasswordSchema = z
  .object({
    password: z.string().min(1).max(256)
  })
  .strict()

export const createAuthRoutes = (clientManager: ClientManager): Hono<TAppEnv> => {
  const route = new Hono<TAppEnv>()

  route.get('/auth/status', async (context) => {
    const status = await clientManager.getAuthStatus(context.get('telegramId'))

    return context.json(status)
  })

  route.post('/auth/send-code', zValidator('json', SendCodeSchema), async (context) => {
    const payload = context.req.valid('json')
    const status = await clientManager.sendCode(context.get('telegramId'), payload.phone)

    return context.json(status)
  })

  route.post('/auth/sign-in', zValidator('json', SignInSchema), async (context) => {
    const payload = context.req.valid('json')
    const status = await clientManager.signIn(context.get('telegramId'), payload.code)

    return context.json(status)
  })

  route.post('/auth/resend-code', zValidator('json', ResendCodeSchema), async (context) => {
    const status = await clientManager.resendCode(context.get('telegramId'))

    return context.json(status)
  })

  route.post('/auth/check-password', zValidator('json', PasswordSchema), async (context) => {
    const payload = context.req.valid('json')
    const status = await clientManager.checkPassword(
      context.get('telegramId'),
      payload.password
    )

    return context.json(status)
  })

  return route
}
