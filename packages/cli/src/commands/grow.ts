import { createServer, mergeConfig } from 'vite'
import { createServer as createHttpServer, type Server } from 'node:http'
import { defineCommand } from 'citty'
import sirv from 'sirv'
import { waldPlugin } from '../vite-plugin.js'
import { loadWaldConfig } from '../config.js'
import { matchRoute, scanRoutes, type Route } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'
import { describeError, renderErrorPage } from '../error-page.js'
import { injectPrefetchRuntime } from '../prefetch-runtime.js'
import { injectComponentStyles, componentStylesHref } from '../component-styles.js'
import { collectComponentStyles } from '../style-scan.js'
import { withGrowingTree } from '../growing-tree.js'
import { join } from 'node:path'

type ViteLike = {
  ssrLoadModule: (file: string) => Promise<{ default: { render: (props?: Record<string, unknown>) => Promise<string> } }>
  transformIndexHtml?: (url: string, html: string) => Promise<string>
}

// Strips config.base from an incoming request URL before route matching —
// wald grow's own routing (unlike Vite's own dev-server middleware, which
// already handles base correctly) otherwise has no idea a non-default base
// is configured, so a browser's base-prefixed request never matches any
// route. Returns null (not the unchanged url) when the request doesn't
// start with the configured base at all, so the caller can 404 it instead
// of accidentally matching against a still-prefixed path.
export function stripBase(url: string, base: string): string | null {
  const queryIndex = url.indexOf('?')
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : url.slice(queryIndex)

  const normalizedBase = base.replace(/\/$/, '')
  if (normalizedBase === '') return url
  if (pathname === normalizedBase) return '/' + query
  if (pathname.startsWith(normalizedBase + '/')) return pathname.slice(normalizedBase.length) + query
  return null
}

function printGrowReady(port: number, cwd: string, base: string, routeCount: number, staticCount: number, dynamicCount: number, ms: number) {
  console.log(`\n✔ Dev server ready in ${ms}ms`)
  console.log(`  Local:   http://localhost:${port}${base === '/' ? '' : base}`)
  console.log(`  Root:    ${cwd}`)
  console.log(`  Routes:  ${routeCount} found (${staticCount} static, ${dynamicCount} dynamic)`)
  if (base !== '/') {
    console.log(`  Base:    ${base}`)
  }
  console.log('  Stop:    Ctrl+C')
}

export async function handleRequest(
  routes: Route[],
  url: string,
  vite: ViteLike | undefined,
  routePath = url
): Promise<{ status: number; body: string }> {
  const match = matchRoute(routes, routePath)
  if (!match) return { status: 404, body: 'Page not found' }

  const mod = await vite!.ssrLoadModule(match.route.file)
  const html = await mod.default.render(match.params)
  // Deliberately NOT passing config.base here: injectComponentStyles's link
  // stays root-relative, and vite.transformIndexHtml() below already
  // base-prefixes every root-relative href/src in the page exactly once
  // (the same way it already handles the Vite HMR client and everything
  // else) — baking base in here too would double-prefix it.
  let body = injectComponentStyles(injectPrefetchRuntime(hoistScripts(maybeWrap(html))))
  if (vite!.transformIndexHtml) {
    body = await vite!.transformIndexHtml(url, body)
  }
  return { status: 200, body }
}

// Like Vite: when the default port is taken (e.g. another project's
// `wald grow` is still running), move on to the next free one instead of
// crashing with an unhandled EADDRINUSE. An explicit --port is strict.
export function listenWithFallback(
  server: Server,
  port: number,
  { strict = false, attempts = 10 }: { strict?: boolean; attempts?: number } = {},
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (candidate: number) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.off('listening', onListening)
        if (err.code !== 'EADDRINUSE') return reject(err)
        if (strict || candidate - port + 1 >= attempts) {
          return reject(new Error(`Port ${candidate} is already in use. Stop the other server or pass a different --port.`))
        }
        tryPort(candidate + 1)
      }
      const onListening = () => {
        server.off('error', onError)
        resolve(candidate)
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(candidate)
    }
    tryPort(port)
  })
}

const DEFAULT_PORT = 7233

export const growCommand = defineCommand({
  meta: { description: 'Start the WaldJS dev server' },
  args: {
    port: { type: 'string', description: `Port to listen on (default ${DEFAULT_PORT}; falls back to the next free port)` },
  },
  async run({ args }) {
    const cwd = process.cwd()
    const requestedPort = args.port ? Number(args.port) : DEFAULT_PORT
    if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535) {
      console.error(`[waldjs] Invalid --port: ${args.port}`)
      process.exit(1)
    }
    const pagesDir = join(cwd, 'src', 'pages')
    const publicDir = join(cwd, 'public')
    const srcDir = join(cwd, 'src')
    const routes = scanRoutes(pagesDir)
    const staticCount = routes.filter(r => r.params.length === 0).length
    const dynamicCount = routes.length - staticCount

    const config = await loadWaldConfig(cwd)
    const componentStylesPath = componentStylesHref(config.base)
    const start = Date.now()
    const servePublic = sirv(publicDir, { dev: true })
    const serveSrc = sirv(srcDir, { dev: true })

    // Declared before the Vite server so it can be handed to `hmr.server`
    // below — Vite needs a live http.Server to attach its HMR websocket to
    // when running in middlewareMode, since it isn't creating one itself.
    let vite: Awaited<ReturnType<typeof createServer>>

    const server = createHttpServer((req, res) => {
      const url = req.url ?? '/'
      const routePath = stripBase(url, config.base)

      if (url === componentStylesPath) {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(collectComponentStyles(srcDir))
        return
      }

      if (routePath !== null && routePath.startsWith('/assets/')) {
        req.url = routePath
        serveSrc(req, res, () => {
          if (!res.headersSent && !res.writableEnded) {
            res.writeHead(404, { 'Content-Type': 'text/plain' })
            res.end('Asset not found')
          }
        })
        return
      }

      const afterPublic = async () => {
        if (res.headersSent || res.writableEnded) return

        const routes = scanRoutes(pagesDir)
        const match = routePath !== null ? matchRoute(routes, routePath) : null

        if (!match) {
          vite.middlewares(req, res, () => {
            if (!res.headersSent && !res.writableEnded) {
              res.writeHead(404, { 'Content-Type': 'text/plain' })
              res.end('Page not found')
            }
          })
          return
        }

        try {
          const { status, body } = await handleRequest(routes, url, vite as unknown as ViteLike, routePath!)
          res.writeHead(status, { 'Content-Type': 'text/html' })
          res.end(body)
        } catch (e) {
          const error = e as Error & { loc?: { file?: string; line?: number; column?: number } }
          vite.ssrFixStacktrace(error)
          console.error(`[waldjs] Render failed for ${url}`)
          console.error(describeError(error))
          if (error.loc && !error.loc.file) error.loc.file = match.route.file
          if (!res.headersSent && !res.writableEnded) {
            let body = renderErrorPage(error)
            if (vite.transformIndexHtml) {
              body = await vite.transformIndexHtml(url, body)
            }
            res.writeHead(500, { 'Content-Type': 'text/html' })
            res.end(body)
          }
        }
      }

      // A request outside config.base (routePath === null) must never reach
      // servePublic OR vite.middlewares: Vite's own dev-server middleware
      // serves publicDir files at the unprefixed path too, regardless of
      // base (confirmed by live-testing during design — this is why the
      // fallback itself is skipped entirely here, not just servePublic).
      if (routePath === null) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
        return
      }

      req.url = routePath
      servePublic(req, res, () => {
        req.url = url
        afterPublic()
      })
    })

    vite = await withGrowingTree('Starting dev server...', createServer(mergeConfig(
      config.vite ?? {},
      {
        base: config.base,
        server: { middlewareMode: true, hmr: { server } },
        appType: 'custom',
        plugins: [waldPlugin()],
      },
    )))

    let port: number
    try {
      port = await listenWithFallback(server, requestedPort, { strict: args.port !== undefined })
    } catch (e) {
      console.error(`[waldjs] ${(e as Error).message}`)
      await vite.close()
      process.exit(1)
    }
    if (port !== requestedPort) console.log(`\n  Port ${requestedPort} is in use, using ${port} instead.`)
    printGrowReady(port, cwd, config.base, routes.length, staticCount, dynamicCount, Date.now() - start)

    process.on('SIGINT', async () => {
      await vite.close()
      server.close()
      process.exit(0)
    })
  },
})
