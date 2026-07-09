import { createServer, mergeConfig } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { defineCommand } from 'citty'
import sirv from 'sirv'
import { waldPlugin } from '../vite-plugin.js'
import { loadWaldConfig } from '../config.js'
import { matchRoute, scanRoutes, type Route } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'
import { withGrowingTree } from '../growing-tree.js'
import { join } from 'node:path'

type ViteLike = {
  ssrLoadModule: (file: string) => Promise<{ default: { render: (props?: Record<string, unknown>) => Promise<string> } }>
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
  vite: ViteLike | undefined
): Promise<{ status: number; body: string }> {
  const match = matchRoute(routes, url)
  if (!match) return { status: 404, body: 'Page not found' }

  const mod = await vite!.ssrLoadModule(match.route.file)
  const html = await mod.default.render(match.params)
  return { status: 200, body: hoistScripts(maybeWrap(html)) }
}

export const growCommand = defineCommand({
  meta: { description: 'Start the WaldJS dev server' },
  async run() {
    const cwd = process.cwd()
    const port = 7233
    const pagesDir = join(cwd, 'src', 'pages')
    const publicDir = join(cwd, 'public')
    const srcDir = join(cwd, 'src')
    const routes = scanRoutes(pagesDir)
    const staticCount = routes.filter(r => r.params.length === 0).length
    const dynamicCount = routes.length - staticCount

    const config = await loadWaldConfig(cwd)
    const start = Date.now()

    const vite = await withGrowingTree('Starting dev server...', createServer(mergeConfig(
      config.vite ?? {},
      {
        base: config.base,
        server: { middlewareMode: true },
        appType: 'custom',
        plugins: [waldPlugin()],
      },
    )))
    const servePublic = sirv(publicDir, { dev: true })
    const serveSrc = sirv(srcDir, { dev: true })

    const server = createHttpServer(async (req, res) => {
      const url = req.url ?? '/'

      if (url.startsWith('/assets/')) {
        serveSrc(req, res, () => {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Asset not found')
        })
        return
      }

      servePublic(req, res, () => {})
      if (res.writableEnded) return

      const routes = scanRoutes(pagesDir)
      const match = matchRoute(routes, url)

      if (!match) {
        vite.middlewares(req, res, () => {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Page not found')
        })
        return
      }

      try {
        const mod = await vite.ssrLoadModule(match.route.file)
        const html = await mod.default.render(match.params)
        const full = hoistScripts(maybeWrap(html))
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(full)
      } catch (e) {
        const error = e as Error
        vite.ssrFixStacktrace(error)
        console.error(`[waldjs] Render failed for ${url}`)
        console.error(error.stack ?? String(error))
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(String(error))
      }
    })

    server.listen(port, () => {
      printGrowReady(port, cwd, config.base, routes.length, staticCount, dynamicCount, Date.now() - start)
    })

    process.on('SIGINT', async () => {
      await vite.close()
      server.close()
      process.exit(0)
    })
  },
})
