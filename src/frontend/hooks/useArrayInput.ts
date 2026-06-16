import { useCallback, useState } from 'preact/hooks'

import { splitCommaSeparatedValues } from '@shared/listInput'

interface IUseArrayInputResult {
  value: string
  setValue(value: string): void
  submit(): void
}

export const useArrayInput = (onAdd: (value: string) => void): IUseArrayInputResult => {
  const [value, setValue] = useState('')

  const submit = useCallback(() => {
    const values = splitCommaSeparatedValues(value)

    if (values.length === 0) {
      return
    }

    for (const item of values) {
      onAdd(item)
    }

    setValue('')
  }, [onAdd, value])

  return {
    value,
    setValue,
    submit
  }
}
