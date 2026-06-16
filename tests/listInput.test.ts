import { describe, expect, test } from 'bun:test'

import {
  splitCommaSeparatedValuePairs,
  splitCommaSeparatedValues
} from '@shared/listInput'

describe('splitCommaSeparatedValues', () => {
  test('splits comma-separated values and removes empty entries', () => {
    expect(splitCommaSeparatedValues(' @one, @two ,, keyword ')).toEqual([
      '@one',
      '@two',
      'keyword'
    ])
  })

  test('keeps a single value unchanged after trimming', () => {
    expect(splitCommaSeparatedValues('one keyword')).toEqual(['one keyword'])
  })

  test('maps comma-separated titles to values by position', () => {
    expect(
      splitCommaSeparatedValuePairs('@one, @two, @three', 'One, Two, Three')
    ).toEqual([
      { title: 'One', value: '@one' },
      { title: 'Two', value: '@two' },
      { title: 'Three', value: '@three' }
    ])
  })

  test('keeps title positions aligned when values contain empty slots', () => {
    expect(splitCommaSeparatedValuePairs('@one,,@three', 'One, Two, Three')).toEqual([
      { title: 'One', value: '@one' },
      { title: 'Three', value: '@three' }
    ])
  })
})
