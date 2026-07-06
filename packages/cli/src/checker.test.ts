import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { checkProject } from './checker.js'

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'wald-check-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

const roots: string[] = []
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true })
})

describe('checkProject', () => {
  it('returns empty array for a clean project', () => {
    const root = makeProject({
      'src/pages/index.wald': `---
type Props = { title: string }
const { title } = $props
---
<h1>{title}</h1>`,
    })
    roots.push(root)
    expect(checkProject(root)).toEqual([])
  })

  it('reports a props type error at the original .wald line', () => {
    const root = makeProject({
      'src/pages/index.wald': `---
type Props = { title: string }
const { subtitle } = $props
---
<h1>{subtitle}</h1>`,
    })
    roots.push(root)
    const diags = checkProject(root)
    expect(diags.length).toBeGreaterThan(0)
    expect(diags[0].file).toBe(join(root, 'src/pages/index.wald'))
    expect(diags[0].line).toBe(3)
    expect(diags[0].message).toContain('subtitle')
  })

  it('reports errors in plain .ts files untouched', () => {
    const root = makeProject({
      'src/util.ts': `export const n: number = 'not a number'\n`,
    })
    roots.push(root)
    const diags = checkProject(root)
    expect(diags.length).toBe(1)
    expect(diags[0].file).toBe(join(root, 'src/util.ts'))
    expect(diags[0].line).toBe(1)
  })

  it('resolves .wald-to-.wald imports', () => {
    const root = makeProject({
      'src/components/Card.wald': `---
type Props = { label: string }
const { label } = $props
---
<span>{label}</span>`,
      'src/pages/index.wald': `---
import Card from '../components/Card.wald'
---
<Card label="hi" />`,
    })
    roots.push(root)
    expect(checkProject(root)).toEqual([])
  })

  it('accepts wald:content imports via the shim', () => {
    const root = makeProject({
      'src/pages/blog.wald': `---
import { getCollection } from 'wald:content'
const posts = await getCollection('blog')
---
<p>{posts.length}</p>`,
    })
    roots.push(root)
    expect(checkProject(root)).toEqual([])
  })
})
