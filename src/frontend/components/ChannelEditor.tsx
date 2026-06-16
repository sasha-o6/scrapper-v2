import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Plus,
  Search,
  ShieldAlert,
  Trash2
} from 'lucide-preact'
import { memo } from 'preact/compat'
import { useCallback, useMemo, useState } from 'preact/hooks'

import styles from '@frontend/styles/App.module.scss'
import { cn } from '@frontend/utils/cn'
import { splitCommaSeparatedValuePairs } from '@shared/listInput'
import type { IChannelConfig, TChannelJoinStatus } from '@shared/types'

interface IChannelEditorProps {
  items: IChannelConfig[]
  title: string
  value: string
  onTitleChange(value: string): void
  onValueChange(value: string): void
  onAdd(channel: IChannelConfig): void
  onRemove(value: string): void
  onClear(): void
}

const formatChannelLabel = (channel: IChannelConfig): string =>
  channel.title ? `${channel.title} (${channel.value})` : channel.value

const JOIN_STATUS_LABELS: Record<TChannelJoinStatus, string> = {
  PENDING: 'Очікує',
  JOINED: 'Доєднано',
  REQUEST_SENT: 'Запит',
  WEBVIEW_REQUIRED: 'Перевірка',
  FAILED: 'Помилка'
}

const getStatusIcon = (status: TChannelJoinStatus) => {
  if (status === 'JOINED') {
    return <CheckCircle2 size={14} />
  }

  if (status === 'FAILED') {
    return <AlertTriangle size={14} />
  }

  if (status === 'WEBVIEW_REQUIRED') {
    return <ShieldAlert size={14} />
  }

  return <Clock3 size={14} />
}

export const ChannelEditor = memo(({
  items,
  title,
  value,
  onTitleChange,
  onValueChange,
  onAdd,
  onRemove,
  onClear
}: IChannelEditorProps) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [search, setSearch] = useState('')
  const submit = useCallback(() => {
    const channels = splitCommaSeparatedValuePairs(value, title)

    if (channels.length === 0) {
      return
    }

    for (const channel of channels) {
      onAdd({
        title: channel.title,
        value: channel.value
      })
    }
  }, [onAdd, title, value])
  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('uk-UA')

    if (!normalizedSearch) {
      return items
    }

    return items.filter((item) =>
      [item.title, item.value, item.joinError ?? '']
        .join(' ')
        .toLocaleLowerCase('uk-UA')
        .includes(normalizedSearch)
    )
  }, [items, search])

  return (
    <section className={styles.listEditor} aria-label="Канали">
      <div className={styles.sectionHeader}>
        <h3>Канали</h3>
        <span>{items.length}</span>
      </div>
      <div className={styles.channelForm}>
        <input
          className={styles.input}
          value={title}
          placeholder="Назва каналу"
          onInput={(event) => onTitleChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit()
            }
          }}
        />
        <input
          className={styles.input}
          value={value}
          placeholder="Посилання або ID"
          onInput={(event) => onValueChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submit()
            }
          }}
        />
        <button className={styles.iconButton} type="button" title="Додати" onClick={submit}>
          <Plus size={18} />
        </button>
      </div>
      <div className={cn(styles.listToolbar, styles.channelListToolbar)}>
        <button
          className={cn(styles.ghostIconButton, styles.neutralIconButton)}
          type="button"
          title={isExpanded ? 'Згорнути' : 'Розгорнути'}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          <ChevronDown className={isExpanded ? styles.chevronOpen : ''} size={16} />
        </button>
        <label className={styles.searchField}>
          <Search size={16} />
          <input
            value={search}
            placeholder="Пошук"
            disabled={items.length === 0}
            onInput={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <button
          className={styles.ghostIconButton}
          type="button"
          title="Видалити все"
          disabled={items.length === 0}
          onClick={onClear}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {isExpanded ? (
        <div className={styles.list}>
          {filteredItems.map((item) => {
            const joinStatus = item.joinStatus ?? 'PENDING'

            return (
              <div className={styles.channelItem} key={item.value}>
                <div className={styles.channelMeta}>
                  <span>{formatChannelLabel(item)}</span>
                  <span className={styles.channelStatus} data-status={joinStatus}>
                    {getStatusIcon(joinStatus)}
                    {JOIN_STATUS_LABELS[joinStatus]}
                  </span>
                  {item.joinError ? (
                    <small className={styles.channelError}>{item.joinError}</small>
                  ) : null}
                </div>
                <button
                  className={styles.ghostIconButton}
                  type="button"
                  title="Видалити"
                  onClick={() => onRemove(item.value)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
})
