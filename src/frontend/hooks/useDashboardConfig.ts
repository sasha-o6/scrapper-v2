import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'

import type {
  IChannelConfig,
  IConfigDto,
  IConfigUpdatePayload,
  IHistoryPayload,
  IHistoryResultDto
} from '@shared/types'

interface IPendingChannelState {
  title: string
  value: string
}

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
  pendingChannel: IPendingChannelState
  setTargetChat(value: string): void
  setIsActive(value: boolean): void
  setStrictMode(value: boolean): void
  setHistoryDepthDays(value: number): void
  setPendingChannelTitle(value: string): void
  setPendingChannelValue(value: string): void
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
  const [pendingChannel, setPendingChannel] = useState<IPendingChannelState>({
    title: '',
    value: ''
  })
  const [historyMessage, setHistoryMessage] = useState('')

  useEffect(() => {
    setDraft(config)
  }, [config])

  const hasPendingChannel = useMemo(
    () => pendingChannel.value.trim().length > 0,
    [pendingChannel.value]
  )
  const isDirty = useMemo(
    () => hasPendingChannel || JSON.stringify(draft) !== JSON.stringify(config),
    [config, draft, hasPendingChannel]
  )

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

  const mergeChannel = useCallback((items: IChannelConfig[], channel: IChannelConfig) => {
    const value = channel.value.trim()

    if (!value) {
      return items
    }

    const channels = items.filter((item) => item.value !== value)

    return [
      ...channels,
      {
        title: channel.title.trim(),
        value
      }
    ]
  }, [])

  const addChannel = useCallback((channel: IChannelConfig) => {
    setDraft((current) => ({
      ...current,
      channels: mergeChannel(current.channels, channel)
    }))
    setPendingChannel({ title: '', value: '' })
  }, [mergeChannel])

  const getChannelsForSave = useCallback(() => {
    if (!hasPendingChannel) {
      return draft.channels
    }

    return mergeChannel(draft.channels, pendingChannel)
  }, [draft.channels, hasPendingChannel, mergeChannel, pendingChannel])

  const setPendingChannelTitle = useCallback((title: string) => {
    setPendingChannel((current) => ({ ...current, title }))
  }, [])

  const setPendingChannelValue = useCallback((value: string) => {
    setPendingChannel((current) => ({ ...current, value }))
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
    const channels = getChannelsForSave()
    const nextConfig = await onSave({
      targetChat: draft.targetChat,
      isActive: draft.isActive,
      channels: channels.map((channel) => ({
        title: channel.title,
        value: channel.value
      })),
      keyWords: draft.keyWords,
      strictMode: draft.strictMode,
      additionalWords: draft.additionalWords,
      banWords: draft.banWords,
      historyDepthDays: draft.historyDepthDays
    })
    setDraft(nextConfig)
    setPendingChannel({ title: '', value: '' })
  }, [draft, getChannelsForSave, onSave])

  const collectHistory = useCallback(async () => {
    const result = await onCollectHistory({ days: draft.historyDepthDays })
    setHistoryMessage(`У чергу додано: ${result.queued}`)
  }, [draft.historyDepthDays, onCollectHistory])

  return {
    draft,
    isDirty,
    historyMessage,
    pendingChannel,
    setTargetChat: (targetChat) => patchDraft({ targetChat }),
    setIsActive: (isActive) => patchDraft({ isActive }),
    setStrictMode: (strictMode) => patchDraft({ strictMode }),
    setHistoryDepthDays: (historyDepthDays) => patchDraft({ historyDepthDays }),
    setPendingChannelTitle,
    setPendingChannelValue,
    addChannel,
    removeChannel,
    addListItem,
    removeListItem,
    save,
    collectHistory
  }
}
