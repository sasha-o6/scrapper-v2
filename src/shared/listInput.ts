export interface ICommaSeparatedValuePair {
  title: string
  value: string
}

const splitCommaSeparatedSlots = (value: string): string[] =>
  value.split(',').map((item) => item.trim())

export const splitCommaSeparatedValues = (value: string): string[] =>
  splitCommaSeparatedSlots(value).filter(Boolean)

export const splitCommaSeparatedValuePairs = (
  value: string,
  title: string
): ICommaSeparatedValuePair[] => {
  const valueSlots = splitCommaSeparatedSlots(value)
  const titleSlots = splitCommaSeparatedSlots(title)
  const pairs: ICommaSeparatedValuePair[] = []

  for (const [index, valueSlot] of valueSlots.entries()) {
    if (!valueSlot) {
      continue
    }

    pairs.push({
      title: titleSlots[index] ?? '',
      value: valueSlot
    })
  }

  return pairs
}
