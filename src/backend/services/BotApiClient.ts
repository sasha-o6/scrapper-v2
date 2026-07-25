interface IBotApiResponse<TResult> {
  ok: boolean
  result?: TResult
  description?: string
}

interface IBotApiMessage {
  message_id: number
  chat: {
    id: number
  }
  from?: {
    id: number
  }
  text?: string
}

export interface IBotApiUpdate {
  update_id: number
  message?: IBotApiMessage
}

export interface IBotApiUser {
  id: number
  is_bot: boolean
  first_name: string
  username?: string
}

export class BotApiClient {
  private readonly baseUrl: string
  public readonly tokenBotId: string | null
  private selfRef: string | null = null

  public constructor(botToken: string) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`
    this.tokenBotId = botToken.split(':')[0] || null
  }

  public async getSelfRef(): Promise<string | null> {
    if (this.selfRef) {
      return this.selfRef
    }

    try {
      const bot = await this.getMe()
      this.selfRef = bot.username ? `@${bot.username}` : bot.id.toString()

      return this.selfRef
    } catch {
      return this.tokenBotId
    }
  }

  public async getUpdates(offset: number): Promise<IBotApiUpdate[]> {
    return this.request<IBotApiUpdate[]>('getUpdates', {
      offset,
      timeout: 0,
      allowed_updates: ['message']
    })
  }

  public async getMe(): Promise<IBotApiUser> {
    return this.request<IBotApiUser>('getMe', {})
  }

  public async sendMessage(chatId: string, text: string): Promise<void> {
    await this.request('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    })
  }

  private async request<TResult>(
    method: string,
    payload: Record<string, unknown>
  ): Promise<TResult> {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    const body = (await response.json()) as IBotApiResponse<TResult>

    if (!response.ok || !body.ok) {
      throw new Error(body.description ?? `Telegram Bot API request failed: ${method}`)
    }

    return body.result as TResult
  }
}
