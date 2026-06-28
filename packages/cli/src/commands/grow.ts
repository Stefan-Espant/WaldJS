import { createServer } from 'vite'
import { createServer as createHttpServer } from 'node:http'
import { defineCommand } from 'citty'
import ora from 'ora'
import { waldPlugin } from '@waldjs/compiler'
import { matchRoute, scanRoutes, type Route } from '../router/index.js'
import { wrapHtml } from '../shell.js'
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
  return { status: 200, body: wrapHtml(html) }
}

export const growCommand = defineCommand({
  meta: { description: 'Start the WaldJS dev server' },
  async run() {
    const port = 7233
    const pagesDir = join(process.cwd(), 'src', 'pages')
    const routes = scanRoutes(pagesDir)

    const spinner = ora('Starting dev server...').start()

    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
      plugins: [waldPlugin()],
    })

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
        const full = wrapHtml(html)
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
      spinner.succeed(`WaldJS dev server running at http://localhost:${port}`)
      console.log('\n  Press Ctrl+C to stop')
    })

    process.on('SIGINT', async () => {
      await vite.close()
      server.close()
      process.exit(0)
    })
  },
})
