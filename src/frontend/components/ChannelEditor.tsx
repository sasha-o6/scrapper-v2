import { Plus, Trash2 } from 'lucide-preact'
import { memo } from 'preact/compat'
import { useCallback, useState } from 'preact/hooks'

import styles from '@frontend/styles/App.module.scss'
import type { IChannelConfig } from '@shared/types'

interface IChannelEditorProps {
  items: IChannelConfig[]
  onAdd(channel: IChannelConfig): void
  onRemove(value: string): void
}

export const ChannelEditor = memo(({ items, onAdd, onRemove }: IChannelEditorProps) => {
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')

  const submit = useCallback(() => {
    const nextValue = value.trim()

    if (!nextValue) {
      return
    }

    onAdd({
      title,
      value: nextValue
    })
    setTitle('')
    setValue('')
  }, [onAdd, title, value])

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
          onInput={(event) => setTitle(event.currentTarget.value)}
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
          onInput={(event) => setValue(event.currentTarget.value)}
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
      <div className={styles.list}>
        {items.map((item) => (
          <div className={styles.listItem} key={item.value}>
            <span>{item.title || item.value}</span>
            <button
              className={styles.ghostIconButton}
              type="button"
              title="Видалити"
              onClick={() => onRemove(item.value)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
})
