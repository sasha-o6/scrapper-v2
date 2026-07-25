import { useCallback, useEffect, useState } from 'preact/hooks'

import type { IApiClient } from '@frontend/api/client'
import type { IBannedSenderDto } from '@shared/types'

export interface IUseBannedSendersResult {
  items: IBannedSenderDto[]
  isLoading: boolean
  error: string
  reload(): Promise<void>
  remove(id: string): Promise<void>
}

export const useBannedSenders = (apiClient: IApiClient): IUseBannedSendersResult => {
  const [items, setItems] = useState<IBannedSenderDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      setItems(await apiClient.get<IBannedSenderDto[]>('/banned-senders'))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити список')
    } finally {
      setIsLoading(false)
    }
  }, [apiClient])

  const remove = useCallback(
    async (id: string) => {
      setError('')

      try {
        await apiClient.del(`/banned-senders/${id}`)
        setItems((current) => current.filter((item) => item.id !== id))
      } catch (removeError) {
        setError(
          removeError instanceof Error ? removeError.message : 'Не вдалося видалити користувача'
        )
      }
    },
    [apiClient]
  )

  useEffect(() => {
    void reload()
  }, [reload])

  return { items, isLoading, error, reload, remove }
}
