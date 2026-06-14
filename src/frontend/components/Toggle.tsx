import { memo } from 'preact/compat'

import { cn } from '@frontend/utils/cn'
import styles from '@frontend/styles/App.module.scss'

interface IToggleProps {
  checked: boolean
  label: string
  onChange(value: boolean): void
}

export const Toggle = memo(({ checked, label, onChange }: IToggleProps) => (
  <button
    className={cn(styles.toggle, checked && styles.toggleActive)}
    type="button"
    role="switch"
    aria-checked={checked}
    title={label}
    onClick={() => onChange(!checked)}
  >
    <span className={styles.toggleKnob} />
    <span>{label}</span>
  </button>
))
