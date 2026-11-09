import { afterEach, describe, expect, it } from 'vitest'
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { scaffold } from './plant.js'

const cli = fileURLToPath(new URL('../../bin/wald.js', import.meta.url))
const roots: string[] = []
const children: ChildProcess[] = []

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    const exited = once(child, 'exit')
    child.kill('SIGINT')
    await exited
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

async function site() {
  const root = mkdtempSync(join(tmpdir(), 'wald-site-integration-'))
  roots.push(root)
  await scaffold(root)
  return root
}

function write(root: string, path: string, content: string) {
  const file = join(root, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

async function grow(root: string) {
  const probe = createServer()
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = (probe.address() as { port: number }).port
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()))
  const child = spawn(process.execPath, [cli, 'grow', '--port', String(port)], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  })
  children.push(child)
  await new Promise<void>((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => finish(new Error(`Dev server did not start: ${output}`)), 10000)
    const finish = (error?: Error) => {
      clearTimeout(timer)
      child.off('exit', onExit)
      child.off('error', onError)
      error ? reject(error) : resolve()
    }
    const onExit = () => finish(new Error(`Dev server exited: ${output}`))
    const onError = (error: Error) => finish(error)
    child.once('exit', onExit)
    child.once('error', onError)
    child.stdout!.on('data', data => {
      output += String(data)
      if (output.includes('Dev server ready')) finish()
    })
    child.stderr!.on('data', data => { output += String(data) })
  })
  return `http://127.0.0.1:${port}`
}

describe('wald grow assets (#51)', () => {
  it.each(['/', '/my-forest/', '/my-forest'])('enforces base %s for public and source assets over HTTP', async base => {
    const root = await site()
    write(root, 'wald.config.ts', `export default { base: ${JSON.stringify(base)} }`)
    write(root, 'public/base-probe.txt', 'public asset')
    write(root, 'src/assets/base-probe.txt', 'source asset')
    const origin = await grow(root)
    const prefix = base.replace(/\/$/, '')
    for (const [path, body] of [['/base-probe.txt', 'public asset'], ['/assets/base-probe.txt', 'source asset']]) {
      const response = await fetch(`${origin}${prefix}${path}?version=1`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(body)
      if (prefix) {
        expect((await fetch(origin + path)).status).toBe(404)
        expect((await fetch(origin + '/my-forest-extra' + path)).status).toBe(404)
      }
    }
    expect((await fetch(origin + prefix + '/missing.txt')).status).toBe(404)
  }, 20000)
})

async function publishingSite() {
  const root = await site()
  // Keep the fixture focused on content-derived routes and indexes.
  rmSync(join(root, 'src/pages'), { recursive: true })
  rmSync(join(root, 'content/blog'), { recursive: true })
  for (const [slug, fields] of [
    ['visible', ''],
    ['draft', 'draft: true'],
    ['scheduled', 'publishDate: "9999-01-01T00:00:00Z"'],
  ]) write(root, `content/blog/${slug}.md`, `---\ntitle: ${slug}\n${fields}\n---\nPost`)
  write(root, 'src/pages/index.wald', `---
import { getCollection } from 'wald:content'
const posts = await getCollection('blog')
---
<p>{posts.map(post => post.slug).join(',')}</p>`)
  write(root, 'src/pages/blog/[slug].wald', `---
import { getCollection, getEntry } from 'wald:content'
export async function getStaticPaths() {
  return (await getCollection('blog')).map(post => ({ params: { slug: post.slug } }))
}
const post = await getEntry('blog', $$props.slug)
---
<h1>{post.slug}</h1>`)
  return root
}

describe('content publishing through the real CLI (#80)', () => {
  it('shows drafts and scheduled posts in wald grow', async () => {
    const root = await publishingSite()
    const origin = await grow(root)
    expect(await (await fetch(origin)).text()).toContain('draft,scheduled,visible')
    for (const slug of ['draft', 'scheduled']) {
      const response = await fetch(`${origin}/blog/${slug}`)
      expect(response.status).toBe(200)
      expect(await response.text()).toContain(`<h1>${slug}</h1>`)
    }
  }, 20000)

  it.each(['esbuild', 'vite'])('omits unpublished posts from the %s build and sitemap', async bundler => {
    const root = await publishingSite()
    // Simulate pages left behind by an earlier build before the posts became drafts.
    write(root, 'dist/blog/draft/index.html', '<h1>Previously published draft</h1>')
    write(root, 'dist/blog/scheduled/index.html', '<h1>Previously published scheduled post</h1>')
    write(root, 'dist/blog/nested/old/index.html', '<h1>Old nested post</h1>')
    write(root, 'dist/unmanaged/index.html', '<h1>Unrelated output</h1>')
    execFileSync(process.execPath, [cli, 'build'], {
      cwd: root, stdio: 'pipe', timeout: 30000,
      env: { ...process.env, WALD_SSR_BUNDLER: bundler },
    })
    expect(readdirSync(join(root, 'dist/blog'))).toEqual(['visible'])
    expect(readFileSync(join(root, 'dist/unmanaged/index.html'), 'utf8')).toBe('<h1>Unrelated output</h1>')
    const index = readFileSync(join(root, 'dist/index.html'), 'utf8')
    expect(index).toContain('<p>visible</p>')
    expect(index).not.toContain('draft')
    expect(index).not.toContain('scheduled')
    const sitemap = fileURLToPath(new URL('../../../../marketing/scripts/build-sitemap.mjs', import.meta.url))
    execFileSync(process.execPath, [sitemap, root, 'https://example.com'], { stdio: 'pipe' })
    const xml = readFileSync(join(root, 'dist/sitemap.xml'), 'utf8')
    expect(xml).toContain('/blog/visible')
    expect(xml).not.toContain('/blog/draft')
    expect(xml).not.toContain('/blog/scheduled')
  }, 40000)
})
