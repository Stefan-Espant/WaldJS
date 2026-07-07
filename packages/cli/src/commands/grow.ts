import { createServer, mergeConfig } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { defineCommand } from 'citty'
import { waldPlugin } from '../vite-plugin.js'
import { loadWaldConfig } from '../config.js'
import { matchRoute, scanRoutes, type Route } from '../router/index.js'
import { maybeWrap, hoistScripts } from '../shell.js'
import { withGrowingTree } from '../growing-tree.js'
import { join } from 'node:path'

type ViteLike = {
  ssrLoadModule: (file: string) => Promise<{ default: { render: (props?: Record<string, unknown>) => Promise<string> } }>
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
    const routes = scanRoutes(pagesDir)
    const staticCount = routes.filter(r => r.params.length === 0).length
    const dynamicCount = routes.length - staticCount

    const config = await loadWaldConfig(cwd)
    const start = Date.now()

    // config.vite goes first so WaldJS critical settings in second arg always win
    const vite = await withGrowingTree('Starting dev server...', createServer(mergeConfig(
      config.vite ?? {},
      {
        base: config.base,
        server: { middlewareMode: true },
        appType: 'custom',
        plugins: [waldPlugin()],
      },
    )))

    const server = createHttpServer(async (req, res) => {
      const url = req.url ?? '/'
      const match = matchRoute(routes, url)

      if (!match) {
        // Let Vite handle non-page requests (HMR, assets)
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
        vite.ssrFixStacktrace(e as Error)
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(String(e))
      }
    })

    // Attach Vite's middleware to the http server for HMR
    server.on('request', (req, res) => {
      if (req.url?.startsWith('/@') || req.url?.startsWith('/node_modules')) {
        vite.middlewares(req, res, () => {})
      }
    })

    server.listen(port, () => {
      const ms = Date.now() - start
      const routeWord = routes.length === 1 ? 'route' : 'routes'
      console.log(`\n✔ Dev server ready in ${ms}ms`)
      console.log(`\n  \x1b[32m➜\x1b[0m  Local:   http://localhost:${port}`)
      console.log(`     ${routes.length} ${routeWord} found (${staticCount} static, ${dynamicCount} dynamic)`)
      console.log('\n  Press Ctrl+C to stop')
    })

    process.on('SIGINT', async () => {
      await vite.close()
      server.close()
      process.exit(0)
    })
  },
})
