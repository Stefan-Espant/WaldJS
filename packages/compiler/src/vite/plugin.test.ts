import { describe, it, expect } from 'vitest'
import { waldPlugin } from './plugin.js'

describe('waldPlugin', () => {
  it('resolves wald:content to a virtual module id', () => {
    const plugins = waldPlugin()
    const contentPlugin = plugins.find(p => p.name === 'vite-plugin-wald-content')!
    const resolved = (contentPlugin.resolveId as Function)('wald:content', undefined, {})
    expect(resolved).toBe('\0wald:content')
  })

  it('loads wald:content with getCollection and getEntry exports', () => {
    const plugins = waldPlugin()
    const contentPlugin = plugins.find(p => p.name === 'vite-plugin-wald-content')!
    const code = (contentPlugin.load as Function)('\0wald:content')
    expect(code).toContain('export const getCollection')
    expect(code).toContain('export const getEntry')
  })
})
