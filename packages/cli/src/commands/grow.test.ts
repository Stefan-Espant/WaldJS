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

  it('injects the prefetch runtime when the rendered page uses wald:prefetch', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: {
          render: async () => '<a href="/x" wald:prefetch="hover">x</a>',
        },
      }),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any)
    expect(result.body).toContain('<script>')
    expect(result.body).toContain('wald:prefetch')
  })

  it('does not inject the prefetch runtime for a page without wald:prefetch', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: {
          render: async () => '<a href="/x">x</a>',
        },
      }),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any)
    expect(result.body).not.toContain('<script>')
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

  it('runs the response through transformIndexHtml to inject the Vite HMR client', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: { render: async () => '<p>About</p>' },
      }),
      transformIndexHtml: async (_url: string, html: string) =>
        html.replace('</head>', '<script type="module" src="/@vite/client"></script></head>'),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any)
    expect(result.body).toContain('<script type="module" src="/@vite/client"></script>')
  })

  it('injects the component-styles link when the rendered page uses a styled component', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: { render: async () => '<div class="card" data-wald-ab12cd34>Hi</div>' },
      }),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any)
    expect(result.body).toContain('<link rel="stylesheet" href="/assets/wald-components.css">')
  })

  it('does not inject the component-styles link for a page with no styled components', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: { render: async () => '<p>About</p>' },
      }),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any)
    expect(result.body).not.toContain('wald-components.css')
  })

  it('leaves the component-styles link root-relative and lets transformIndexHtml apply base once (not double-prefixed)', async () => {
    const routes = [{ pattern: '/about', file: '/pages/about.wald', params: [] }]
    const fakeVite = {
      ssrLoadModule: async (_file: string) => ({
        default: { render: async () => '<div class="card" data-wald-ab12cd34>Hi</div>' },
      }),
      // Mimics Vite's real transformIndexHtml: it joins config.base onto
      // any root-relative href/src exactly once. If handleRequest already
      // baked a base into the link itself, this would double it up — this
      // test catches that regression class.
      transformIndexHtml: async (_url: string, html: string) =>
        html.replace(/(href|src)="\/(?!\/)/g, '$1="/my-forest/'),
    }

    const result = await handleRequest(routes, '/about', fakeVite as any)
    expect(result.body).toContain('<link rel="stylesheet" href="/my-forest/assets/wald-components.css">')
    expect(result.body).not.toContain('/my-forest/my-forest/')
  })
})
