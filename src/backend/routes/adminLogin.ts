import { Hono } from 'hono'

import type { AdminLoginWebService } from '@backend/services/AdminLoginWebService'

const html = (body: string): Response =>
  new Response(body, {
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

const readFormValue = async (request: Request, key: string): Promise<string> => {
  const form = await request.formData()
  const value = form.get(key)

  return typeof value === 'string' ? value : ''
}

export const createAdminLoginRoutes = (
  adminLoginWebService: AdminLoginWebService
): Hono => {
  const route = new Hono()

  route.get('/admin/login/:token', async (context) =>
    html(await adminLoginWebService.render(context.req.param('token')))
  )

  route.post('/admin/login/:token/code', async (context) => {
    const code = await readFormValue(context.req.raw, 'code')

    return html(await adminLoginWebService.submitCode(context.req.param('token'), code))
  })

  route.post('/admin/login/:token/password', async (context) => {
    const password = await readFormValue(context.req.raw, 'password')

    return html(await adminLoginWebService.submitPassword(context.req.param('token'), password))
  })

  return route
}
