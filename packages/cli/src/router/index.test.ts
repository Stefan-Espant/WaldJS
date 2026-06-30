import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { scanRoutes, matchRoute } from './index.js'

let pagesDir: string

beforeEach(() => {
  pagesDir = mkdtempSync(join(tmpdir(), 'wald-router-'))
})

describe('scanRoutes', () => {
  it('maps index.wald to /', () => {
    writeFileSync(join(pagesDir, 'index.wald'), '')
    const routes = scanRoutes(pagesDir)
    expect(routes).toEqual([{ pattern: '/', file: join(pagesDir, 'index.wald'), params: [] }])
  })

  it('maps about.wald to /about', () => {
    writeFileSync(join(pagesDir, 'about.wald'), '')
    const routes = scanRoutes(pagesDir)
    expect(routes).toEqual([{ pattern: '/about', file: join(pagesDir, 'about.wald'), params: [] }])
  })

  it('maps blog/[slug].wald to /blog/:slug with params', () => {
    mkdirSync(join(pagesDir, 'blog'))
    writeFileSync(join(pagesDir, 'blog', '[slug].wald'), '')
    const routes = scanRoutes(pagesDir)
    expect(routes).toEqual([{
      pattern: '/blog/:slug',
      file: join(pagesDir, 'blog', '[slug].wald'),
      params: ['slug'],
    }])
  })

  it('maps blog/index.wald to /blog', () => {
    mkdirSync(join(pagesDir, 'blog'))
    writeFileSync(join(pagesDir, 'blog', 'index.wald'), '')
    const routes = scanRoutes(pagesDir)
    expect(routes).toEqual([{ pattern: '/blog', file: join(pagesDir, 'blog', 'index.wald'), params: [] }])
  })
})

describe('matchRoute', () => {
  it('matches / to index route', () => {
    const routes = [{ pattern: '/', file: '/pages/index.wald', params: [] }]
    expect(matchRoute(routes, '/')).toEqual({ route: routes[0], params: {} })
  })

  it('matches /about to about route', () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    expect(matchRoute(routes, '/about')).toEqual({ route: routes[0], params: {} })
  })

  it('matches /blog/hello-world and extracts slug', () => {
    const routes = [{ pattern: '/blog/:slug', file: '/pages/blog/[slug].wald', params: ['slug'] }]
    expect(matchRoute(routes, '/blog/hello-world')).toEqual({
      route: routes[0],
      params: { slug: 'hello-world' },
    })
  })

  it('returns null for unmatched URL', () => {
    const routes = [{ pattern: '/', file: '/pages/index.wald', params: [] }]
    expect(matchRoute(routes, '/nonexistent')).toBeNull()
  })
})
