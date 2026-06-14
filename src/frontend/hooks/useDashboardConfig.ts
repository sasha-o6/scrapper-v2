import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'

import type {
  IChannelConfig,
  IConfigDto,
  IConfigUpdatePayload,
  IHistoryPayload,
  IHistoryResultDto
} from '@shared/types'

export type TListKey = 'keyWords' | 'additionalWords' | 'banWords'

interface IUseDashboardConfigParams {
  config: IConfigDto
  onSave(payload: IConfigUpdatePayload): Promise<IConfigDto>
  onCollectHistory(payload: IHistoryPayload): Promise<IHistoryResultDto>
}

interface IUseDashboardConfigResult {
  draft: IConfigDto
  isDirty: boolean
  historyMessage: string
  setTargetChat(value: string): void
  setIsActive(value: boolean): void
  setStrictMode(value: boolean): void
  setHistoryDepthDays(value: number): void
  addChannel(channel: IChannelConfig): void
  removeChannel(value: string): void
  addListItem(key: TListKey, value: string): void
  removeListItem(key: TListKey, value: string): void
  save(): Promise<void>
  collectHistory(): Promise<void>
}

export const useDashboardConfig = ({
  config,
  onSave,
  onCollectHistory
}: IUseDashboardConfigParams): IUseDashboardConfigResult => {
  const [draft, setDraft] = useState(config)
  const [historyMessage, setHistoryMessage] = useState('')

  useEffect(() => {
    setDraft(config)
  }, [config])

  const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(config), [config, draft])

  const patchDraft = useCallback((payload: Partial<IConfigDto>) => {
    setDraft((current) => ({
      ...current,
      ...payload
    }))
  }, [])

  const addListItem = useCallback((key: TListKey, value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: Array.from(new Set([...current[key], value.trim()].filter(Boolean)))
    }))
  }, [])

  const addChannel = useCallback((channel: IChannelConfig) => {
    const value = channel.value.trim()

    if (!value) {
      return
    }

    setDraft((current) => {
      const channels = current.channels.filter((item) => item.value !== value)

      return {
        ...current,
        channels: [
          ...channels,
          {
            title: channel.title.trim(),
            value
          }
        ]
      }
    })
  }, [])

  const removeChannel = useCallback((value: string) => {
    setDraft((current) => ({
      ...current,
      channels: current.channels.filter((channel) => channel.value !== value)
    }))
  }, [])

  const removeListItem = useCallback((key: TListKey, value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: current[key].filter((item) => item !== value)
    }))
  }, [])

  const save = useCallback(async () => {
    const nextConfig = await onSave({
      targetChat: draft.targetChat,
      isActive: draft.isActive,
      channels: draft.channels,
      keyWords: draft.keyWords,
      strictMode: draft.strictMode,
      additionalWords: draft.additionalWords,
      banWords: draft.banWords,
      historyDepthDays: draft.historyDepthDays
    })
    setDraft(nextConfig)
  }, [draft, onSave])

  const collectHistory = useCallback(async () => {
    const result = await onCollectHistory({ days: draft.historyDepthDays })
    setHistoryMessage(`У чергу додано: ${result.queued}`)
  }, [draft.historyDepthDays, onCollectHistory])

  return {
    draft,
    isDirty,
    historyMessage,
    setTargetChat: (targetChat) => patchDraft({ targetChat }),
    setIsActive: (isActive) => patchDraft({ isActive }),
    setStrictMode: (strictMode) => patchDraft({ strictMode }),
    setHistoryDepthDays: (historyDepthDays) => patchDraft({ historyDepthDays }),
    addChannel,
    removeChannel,
    addListItem,
    removeListItem,
    save,
    collectHistory
  }
}
