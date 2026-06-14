import { useCallback, useState } from 'preact/hooks'

interface IUseArrayInputResult {
  value: string
  setValue(value: string): void
  submit(): void
}

export const useArrayInput = (onAdd: (value: string) => void): IUseArrayInputResult => {
  const [value, setValue] = useState('')

  const submit = useCallback(() => {
    const trimmed = value.trim()

    if (!trimmed) {
      return
    }

    onAdd(trimmed)
    setValue('')
  }, [onAdd, value])

  return {
    value,
    setValue,
    submit
  }
}
