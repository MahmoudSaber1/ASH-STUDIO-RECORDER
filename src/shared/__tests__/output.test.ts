import { describe, expect, it } from 'vitest'
import { outputSize } from '../output'

describe('outputSize', () => {
  it('keeps the source aspect for original', () => {
    expect(outputSize('original', 1080, 16 / 9)).toEqual({ width: 1920, height: 1080 })
  })

  it('makes vertical outputs taller than wide', () => {
    expect(outputSize('9:16', 1080, 16 / 9)).toEqual({ width: 1080, height: 1920 })
  })

  it('always returns even dimensions', () => {
    const size = outputSize('4:3', 721, 16 / 9)
    expect(size.width % 2).toBe(0)
    expect(size.height % 2).toBe(0)
  })
})
