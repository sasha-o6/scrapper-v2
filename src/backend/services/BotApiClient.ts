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

export class BotApiClient {
  private readonly baseUrl: string

  public constructor(botToken: string) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`
  }

  public async getUpdates(offset: number): Promise<IBotApiUpdate[]> {
    return this.request<IBotApiUpdate[]>('getUpdates', {
      offset,
      timeout: 0,
      allowed_updates: ['message']
    })
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
