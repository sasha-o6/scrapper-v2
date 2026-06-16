import { ChevronDown, Copy, Plus, Search, Trash2 } from 'lucide-preact'
import { memo } from 'preact/compat'
import { useCallback, useMemo, useState } from 'preact/hooks'

import { useArrayInput } from '@frontend/hooks/useArrayInput'
import styles from '@frontend/styles/App.module.scss'
import { cn } from '@frontend/utils/cn'

interface IArrayEditorProps {
  label: string
  placeholder: string
  items: string[]
  disabled?: boolean
  onAdd(value: string): void
  onRemove(value: string): void
  onClear(): void
}

export const ArrayEditor = memo(
  ({
    label,
    placeholder,
    items,
    disabled = false,
    onAdd,
    onRemove,
    onClear
  }: IArrayEditorProps) => {
    const input = useArrayInput(onAdd)
    const [isExpanded, setIsExpanded] = useState(true)
    const [search, setSearch] = useState('')
    const filteredItems = useMemo(() => {
      const normalizedSearch = search.trim().toLocaleLowerCase('uk-UA')

      if (!normalizedSearch) {
        return items
      }

      return items.filter((item) =>
        item.toLocaleLowerCase('uk-UA').includes(normalizedSearch)
      )
    }, [items, search])

    const exportItems = useCallback(() => {
      if (items.length === 0 || !navigator.clipboard) {
        return
      }

      void navigator.clipboard.writeText(items.join(', ')).catch(() => undefined)
    }, [items])

    return (
      <section className={styles.listEditor} aria-label={label}>
        <div className={styles.sectionHeader}>
          <h3>{label}</h3>
          <span>{items.length}</span>
        </div>
        <div className={styles.inlineForm}>
          <input
            className={styles.input}
            value={input.value}
            placeholder={placeholder}
            disabled={disabled}
            onInput={(event) => input.setValue(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                input.submit()
              }
            }}
          />
          <button
            className={styles.iconButton}
            type="button"
            title="Додати"
            disabled={disabled}
            onClick={input.submit}
          >
            <Plus size={18} />
          </button>
        </div>
        <div className={styles.listToolbar}>
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
              disabled={disabled || items.length === 0}
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
          </label>
          <button
            className={cn(styles.ghostIconButton, styles.neutralIconButton)}
            type="button"
            title="Експортувати"
            disabled={disabled || items.length === 0}
            onClick={exportItems}
          >
            <Copy size={16} />
          </button>
          <button
            className={styles.ghostIconButton}
            type="button"
            title="Видалити все"
            disabled={disabled || items.length === 0}
            onClick={onClear}
          >
            <Trash2 size={16} />
          </button>
        </div>
        {isExpanded ? (
          <div className={styles.list}>
            {filteredItems.map((item) => (
              <div className={styles.listItem} key={item}>
                <span>{item}</span>
                <button
                  className={styles.ghostIconButton}
                  type="button"
                  title="Видалити"
                  disabled={disabled}
                  onClick={() => onRemove(item)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    )
  }
)
