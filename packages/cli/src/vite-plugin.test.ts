import { describe, it, expect } from 'vitest'
import { waldPlugin } from './vite-plugin.js'
import type { Plugin } from 'vite'

function callHook(pluginName: string, hookName: keyof Plugin, ...args: unknown[]) {
  const plugin = waldPlugin().find(p => p.name === pluginName)!
  return (plugin[hookName] as Function).call({}, ...args)
}

describe('vite-plugin-wald', () => {
  it('resolves .wald file ids to themselves', () => {
    const result = callHook('vite-plugin-wald', 'resolveId', 'src/pages/index.wald', undefined, {})
    expect(result).toBe('src/pages/index.wald')
  })

  it('returns undefined for non-.wald ids in resolveId', () => {
    const result = callHook('vite-plugin-wald', 'resolveId', 'src/index.ts', undefined, {})
    expect(result).toBeUndefined()
  })

  it('transforms .wald source into compiled JS', () => {
    const result = callHook('vite-plugin-wald', 'transform', '---\n---\n<h1>Hi</h1>', 'test.wald')
    expect(result.code).toContain('createTree')
  })

  it('returns undefined for non-.wald files in transform', () => {
    const result = callHook('vite-plugin-wald', 'transform', 'export default {}', 'test.ts')
    expect(result).toBeUndefined()
  })
})

describe('vite-plugin-wald-content', () => {
  it('resolves wald:content to a virtual module id', () => {
    const result = callHook('vite-plugin-wald-content', 'resolveId', 'wald:content', undefined, {})
    expect(result).toBe('\0wald:content')
  })

  it('returns undefined for other ids in resolveId', () => {
    const result = callHook('vite-plugin-wald-content', 'resolveId', 'other:module', undefined, {})
    expect(result).toBeUndefined()
  })

  it('loads wald:content with getCollection and getEntry exports', () => {
    const code = callHook('vite-plugin-wald-content', 'load', '\0wald:content')
    expect(code).toContain('export const getCollection')
    expect(code).toContain('export const getEntry')
  })

  it('returns undefined for other virtual ids in load', () => {
    const code = callHook('vite-plugin-wald-content', 'load', '\0other:module')
    expect(code).toBeUndefined()
  })
})
