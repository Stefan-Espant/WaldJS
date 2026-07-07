import { describe, it, expect, vi } from 'vitest'
import { handleRequest } from './grow.js'

describe('handleRequest', () => {
  it('returns 404 for unmatched URL', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const result = await handleRequest(routes, '/', undefined)
    expect(result).toEqual({ status: 404, body: 'Page not found' })
  })

  it('returns rendered HTML for matched route', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]

    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: {
          render: async (_props?: Record<string, unknown>) => '<p>About</p>',
        },
      }),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any)
    expect(result.status).toBe(200)
    expect(result.body).toContain('<p>About</p>')
    expect(result.body).toContain('<!DOCTYPE html>')
  })

  it('passes URL params to render()', async () => {
    const routes = [{ pattern: '/blog/:slug', file: '/pages/blog/[slug].wald', params: ['slug'] }]
    const capturedProps: Record<string, unknown>[] = []

    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: {
          render: async (props?: Record<string, unknown>) => {
            capturedProps.push(props ?? {})
            return '<h1>Post</h1>'
          },
        },
      }),
    }

    await handleRequest(routes, '/blog/hello-world', fakeVite as any)
    expect(capturedProps[0]).toEqual({ slug: 'hello-world' })
  })

  it('rethrows render errors from ssrLoadModule', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: vi.fn(async () => {
        throw new Error('boom')
      }),
    }

    await expect(handleRequest(routes, '/about', fakeVite as any)).rejects.toThrow('boom')
  })
})
