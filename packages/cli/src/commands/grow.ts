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

function printGrowReady(port: number, cwd: string, base: string) {
  console.log(`  Local:   http://localhost:${port}${base === '/' ? '' : base}`)
  console.log(`  Root:    ${cwd}`)
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

    const config = await loadWaldConfig(cwd)

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
      const routes = scanRoutes(pagesDir)
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
        const error = e as Error
        vite.ssrFixStacktrace(error)
        console.error(`[waldjs] Render failed for ${url}`)
        console.error(error.stack ?? String(error))
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(String(error))
      }
    })

    server.listen(port, () => {
      console.log('WaldJS dev server running')
      printGrowReady(port, cwd, config.base)
    })

    process.on('SIGINT', async () => {
      await vite.close()
      server.close()
      process.exit(0)
    })
  },
})
