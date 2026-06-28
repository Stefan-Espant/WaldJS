import { createServer } from 'node:http'
import { join } from 'node:path'
import sirv from 'sirv'
import { defineCommand } from 'citty'
import ora from 'ora'

export function startPreview(distDir: string, port: number): Promise<ReturnType<typeof createServer>> {
  return new Promise((resolve) => {
    const serve = sirv(distDir, { single: true })
    const server = createServer(serve)
    server.listen(port, () => resolve(server))
  })
}

export const previewCommand = defineCommand({
  meta: { description: 'Preview the production build locally' },
  async run() {
    const distDir = join(process.cwd(), 'dist')
    const port = 4321
    const spinner = ora('Starting preview server...').start()
    const server = await startPreview(distDir, port)
    spinner.succeed(`Preview running at http://localhost:${port}`)
    console.log('\n  Press Ctrl+C to stop')
    process.on('SIGINT', () => { server.close(); process.exit(0) })
  },
})
