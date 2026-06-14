export interface IApiClient {
  get<TResponse>(path: string): Promise<TResponse>
  post<TResponse, TPayload extends object>(path: string, payload: TPayload): Promise<TResponse>
  put<TResponse, TPayload extends object>(path: string, payload: TPayload): Promise<TResponse>
}

interface IRequestOptions<TPayload extends object> {
  method: 'GET' | 'POST' | 'PUT'
  payload?: TPayload
}

const parseJson = async <TResponse>(response: Response): Promise<TResponse> => {
  const text = await response.text()
  let body = {} as TResponse & { error?: string }

  if (text) {
    try {
      body = JSON.parse(text) as TResponse & { error?: string }
    } catch {
      body = {} as TResponse & { error?: string }
    }
  }

  if (!response.ok) {
    throw new Error(body.error ?? (text || `API request failed (${response.status})`))
  }

  return body
}

export const createApiClient = (initData: string): IApiClient => {
  const request = async <TResponse, TPayload extends object = Record<string, never>>(
    path: string,
    options: IRequestOptions<TPayload>
  ): Promise<TResponse> => {
    const headers = new Headers()
    headers.set('content-type', 'application/json')

    if (initData) {
      headers.set('x-telegram-init-data', initData)
    }

    const response = await fetch(`/api${path}`, {
      method: options.method,
      headers,
      body: options.payload ? JSON.stringify(options.payload) : undefined
    })

    return parseJson<TResponse>(response)
  }

  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, payload) => request(path, { method: 'POST', payload }),
    put: (path, payload) => request(path, { method: 'PUT', payload })
  }
}
