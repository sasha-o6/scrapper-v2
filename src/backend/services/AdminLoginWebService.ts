import type { ClientManager, IAdminAuthResult } from '@backend/services/ClientManager'

const TOKEN_TTL_MS = 10 * 60 * 1000

interface ILoginToken {
  token: string
  expiresAt: number
}

interface IRenderParams {
  token: string
  mode: 'code' | 'password' | 'done'
  message: string
  error?: string
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

export class AdminLoginWebService {
  private activeToken: ILoginToken | null = null

  public constructor(
    private readonly clientManager: ClientManager,
    private readonly publicAppUrl: string
  ) {}

  public issueLoginUrl(): string {
    const token = crypto.randomUUID()
    this.activeToken = {
      token,
      expiresAt: Date.now() + TOKEN_TTL_MS
    }

    return `${this.publicAppUrl.replace(/\/$/, '')}/admin/login/${token}`
  }

  public isTokenValid(token: string): boolean {
    if (!this.activeToken || this.activeToken.token !== token) {
      return false
    }

    if (Date.now() > this.activeToken.expiresAt) {
      this.activeToken = null

      return false
    }

    return true
  }

  public async render(token: string): Promise<string> {
    if (!this.isTokenValid(token)) {
      return this.renderExpired()
    }

    const status = await this.clientManager.getAuthStatus()

    if (status === 'PASSWORD_PENDING') {
      return this.renderPage({
        token,
        mode: 'password',
        message: 'Введіть 2FA пароль. Не надсилайте пароль у Telegram чат.'
      })
    }

    if (status === 'LOGGED_IN') {
      this.activeToken = null

      return this.renderPage({
        token,
        mode: 'done',
        message: 'Userbot вже авторизовано.'
      })
    }

    return this.renderPage({
      token,
      mode: 'code',
      message: 'Введіть код Telegram на цій сторінці. Не надсилайте код у Telegram чат.'
    })
  }

  public async submitCode(token: string, code: string): Promise<string> {
    if (!this.isTokenValid(token)) {
      return this.renderExpired()
    }

    const normalizedCode = code.replace(/\D/g, '')

    if (!normalizedCode) {
      return this.renderPage({
        token,
        mode: 'code',
        message: 'Введіть код Telegram на цій сторінці. Не надсилайте код у Telegram чат.',
        error: 'Код порожній або не містить цифр.'
      })
    }

    try {
      const result = await this.clientManager.signInWithCode(normalizedCode)

      return this.renderAuthResult(token, result)
    } catch (error) {
      if (this.isPhoneCodeExpired(error)) {
        await this.clientManager.resetPendingAuthAttempt()
      }

      return this.renderPage({
        token,
        mode: 'code',
        message: 'Запросіть новий код через /login, якщо Telegram уже заблокував цей код.',
        error: this.formatAuthError(error)
      })
    }
  }

  public async submitPassword(token: string, password: string): Promise<string> {
    if (!this.isTokenValid(token)) {
      return this.renderExpired()
    }

    if (!password.trim()) {
      return this.renderPage({
        token,
        mode: 'password',
        message: 'Введіть 2FA пароль. Не надсилайте пароль у Telegram чат.',
        error: 'Пароль порожній.'
      })
    }

    try {
      const result = await this.clientManager.checkPassword(password)

      return this.renderAuthResult(token, result)
    } catch (error) {
      return this.renderPage({
        token,
        mode: 'password',
        message: 'Введіть 2FA пароль. Не надсилайте пароль у Telegram чат.',
        error: this.formatAuthError(error)
      })
    }
  }

  private renderAuthResult(token: string, result: IAdminAuthResult): string {
    if (result.step === 'password') {
      return this.renderPage({
        token,
        mode: 'password',
        message: 'Telegram попросив 2FA пароль. Введіть його тут, не в чаті.'
      })
    }

    this.activeToken = null

    return this.renderPage({
      token,
      mode: 'done',
      message: 'Userbot авторизовано. Можна закрити цю сторінку.'
    })
  }

  private formatAuthError(error: unknown): string {
    if (!(error instanceof Error)) {
      return String(error)
    }

    if (this.isPhoneCodeExpired(error)) {
      return 'Код протух або був заблокований Telegram. Надішліть /login боту ще раз і введіть новий код тільки на цій сторінці.'
    }

    return error.message
  }

  private isPhoneCodeExpired(error: unknown): boolean {
    return error instanceof Error && error.message.includes('PHONE_CODE_EXPIRED')
  }

  private renderExpired(): string {
    return this.renderPage({
      token: '',
      mode: 'done',
      message: 'Посилання протухло. Надішліть /login боту ще раз.'
    })
  }

  private renderPage({ token, mode, message, error }: IRenderParams): string {
    const safeToken = encodeURIComponent(token)
    const title = mode === 'done' ? 'Telegram userbot' : 'Telegram userbot login'
    const form = this.renderForm(safeToken, mode)

    return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7f5;color:#18211d;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(420px,calc(100vw - 32px));border:1px solid #d8e0da;background:#fff;padding:24px}
    h1{margin:0 0 8px;font-size:24px}
    p{margin:0 0 16px;line-height:1.45}
    form{display:flex;flex-direction:column;gap:12px}
    label{display:flex;flex-direction:column;gap:8px;font-weight:700}
    input{height:44px;border:1px solid #cbd5cf;border-radius:6px;padding:0 12px;font-size:16px}
    button{height:44px;border:0;border-radius:6px;background:#2f7d5c;color:#fff;font-weight:800;font-size:15px}
    .error{border:1px solid #e59b9b;background:#fff1f1;color:#9f2f2f;padding:10px;border-radius:6px;font-weight:700}
    .hint{font-size:13px;color:#587064}
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    ${form}
  </main>
</body>
</html>`
  }

  private renderForm(token: string, mode: IRenderParams['mode']): string {
    if (mode === 'done') {
      return '<p class="hint">Ця сторінка більше не приймає дані.</p>'
    }

    if (mode === 'password') {
      return `<form method="post" action="/admin/login/${token}/password">
  <label>2FA пароль<input name="password" type="password" autocomplete="current-password" required autofocus></label>
  <button type="submit">Завершити логін</button>
</form>`
    }

    return `<form method="post" action="/admin/login/${token}/code">
  <label>Код Telegram<input name="code" inputmode="numeric" autocomplete="one-time-code" required autofocus></label>
  <button type="submit">Продовжити</button>
</form>`
  }
}
