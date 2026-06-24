import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createGraph, addNode, needsRecompile } from './index.js'

describe('DependencyGraph', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `wald-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
  })

  it('createGraph returns an empty graph', () => {
    const graph = createGraph()
    expect(graph.nodes.size).toBe(0)
  })

  it('addNode adds a node with mtime from disk', () => {
    const file = join(tmpDir, 'index.wald')
    writeFileSync(file, '<h1>Hello</h1>')

    const graph = createGraph()
    const node = addNode(graph, file)

    expect(node.file).toBe(file)
    expect(node.mtime).toBeGreaterThan(0)
    expect(node.imports).toEqual([])
    expect(node.output).toBeNull()
    expect(graph.nodes.has(file)).toBe(true)
  })

  it('needsRecompile returns false for an unchanged file', () => {
    const file = join(tmpDir, 'page.wald')
    writeFileSync(file, '<h1>Hello</h1>')

    const graph = createGraph()
    const node = addNode(graph, file)

    expect(needsRecompile(node)).toBe(false)
  })

  it('needsRecompile returns true after file is modified', async () => {
    const file = join(tmpDir, 'changed.wald')
    writeFileSync(file, '<h1>Hello</h1>')

    const graph = createGraph()
    const node = addNode(graph, file)

    // Wait 10ms so mtime changes
    await new Promise(r => setTimeout(r, 10))
    writeFileSync(file, '<h1>Updated</h1>')

    expect(needsRecompile(node)).toBe(true)
  })
})
