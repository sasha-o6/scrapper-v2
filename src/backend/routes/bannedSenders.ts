import { Hono } from 'hono'

import type { SenderBanService } from '@backend/services/SenderBanService'
import type { TAppEnv } from '@backend/types'

export const createBannedSenderRoutes = (senderBanService: SenderBanService): Hono<TAppEnv> => {
  const route = new Hono<TAppEnv>()

  route.get('/banned-senders', async (context) => {
    const items = await senderBanService.listByUserId(context.get('userId'))

    return context.json(items)
  })

  route.delete('/banned-senders/:id', async (context) => {
    const removed = await senderBanService.removeById(
      context.get('userId'),
      context.req.param('id')
    )

    if (!removed) {
      return context.json({ error: 'Banned sender not found' }, 404)
    }

    return context.json({ ok: true })
  })

  return route
}
