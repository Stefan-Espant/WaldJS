import { describe, it, expect, vi, afterEach } from 'vitest'
import { withGrowingTree } from './growing-tree.js'

describe('withGrowingTree', () => {
  const originalIsTTY = process.stdout.isTTY
  const originalColumns = process.stdout.columns

  afterEach(() => {
    process.stdout.isTTY = originalIsTTY
    process.stdout.columns = originalColumns
    vi.restoreAllMocks()
  })

  it('falls back to a plain label when stdout is not a TTY', async () => {
    process.stdout.isTTY = false
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await withGrowingTree('Building...', Promise.resolve('done'))

    expect(result).toBe('done')
    expect(logSpy).toHaveBeenCalledWith('Building...')
  })

  it('falls back to a plain label when the terminal is narrower than the animation', async () => {
    process.stdout.isTTY = true
    process.stdout.columns = 60
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const result = await withGrowingTree('Building...', Promise.resolve('done'))

    expect(result).toBe('done')
    expect(logSpy).toHaveBeenCalledWith('Building...')
    expect(writeSpy).not.toHaveBeenCalled()
  })
})
