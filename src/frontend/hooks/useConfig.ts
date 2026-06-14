import { useCallback, useEffect, useState } from 'preact/hooks'

import type { IApiClient } from '@frontend/api/client'
import type {
  IConfigDto,
  IConfigUpdatePayload,
  IHistoryPayload,
  IHistoryResultDto
} from '@shared/types'

interface IUseConfigResult {
  config: IConfigDto | null
  error: string
  isLoading: boolean
  isSaving: boolean
  loadConfig(): Promise<void>
  saveConfig(payload: IConfigUpdatePayload): Promise<IConfigDto>
  collectHistory(payload: IHistoryPayload): Promise<IHistoryResultDto>
}

export const useConfig = (apiClient: IApiClient): IUseConfigResult => {
  const [config, setConfig] = useState<IConfigDto | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      setConfig(await apiClient.get<IConfigDto>('/config'))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не вдалося завантажити')
    } finally {
      setIsLoading(false)
    }
  }, [apiClient])

  const saveConfig = useCallback(
    async (payload: IConfigUpdatePayload) => {
      setIsSaving(true)
      setError('')

      try {
        const nextConfig = await apiClient.put<IConfigDto, IConfigUpdatePayload>(
          '/config',
          payload
        )
        setConfig(nextConfig)

        return nextConfig
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Не вдалося зберегти')
        throw saveError
      } finally {
        setIsSaving(false)
      }
    },
    [apiClient]
  )

  const collectHistory = useCallback(
    async (payload: IHistoryPayload) =>
      apiClient.post<IHistoryResultDto, IHistoryPayload>('/history/collect', payload),
    [apiClient]
  )

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  return {
    config,
    error,
    isLoading,
    isSaving,
    loadConfig,
    saveConfig,
    collectHistory
  }
}
