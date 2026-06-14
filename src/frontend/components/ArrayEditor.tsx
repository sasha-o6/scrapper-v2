import { Plus, Trash2 } from 'lucide-preact'
import { memo } from 'preact/compat'

import { useArrayInput } from '@frontend/hooks/useArrayInput'
import styles from '@frontend/styles/App.module.scss'

interface IArrayEditorProps {
  label: string
  placeholder: string
  items: string[]
  disabled?: boolean
  onAdd(value: string): void
  onRemove(value: string): void
}

export const ArrayEditor = memo(
  ({ label, placeholder, items, disabled = false, onAdd, onRemove }: IArrayEditorProps) => {
    const input = useArrayInput(onAdd)

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
        <div className={styles.list}>
          {items.map((item) => (
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
      </section>
    )
  }
)
