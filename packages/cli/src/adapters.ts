import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type WaldAdapterContext = {
  rootDir: string
  outDir: string
  outDirRelative: string
  base: string
  staticRoutes: number
  dynamicRoutes: number
  dynamicPages: number
  canopyEntries: number
}

export interface WaldAdapter {
  name: string
  outDir?: string
  adapt?: (context: WaldAdapterContext) => void | Promise<void>
}

export function defineAdapter<T extends WaldAdapter>(adapter: T): T {
  return adapter
}

export function staticAdapter(): WaldAdapter {
  return defineAdapter({ name: 'static' })
}

export function netlifyAdapter(): WaldAdapter {
  return defineAdapter({
    name: 'netlify',
    adapt({ outDir }) {
      writeFile(
        join(outDir, '_headers'),
        [
          '/assets/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '',
          '/*',
          '  Cache-Control: public, max-age=0, must-revalidate',
          '',
        ].join('\n'),
      )
    },
  })
}

export function cloudflarePagesAdapter(): WaldAdapter {
  return defineAdapter({
    name: 'cloudflare-pages',
    adapt({ outDir }) {
      writeFile(
        join(outDir, '_headers'),
        [
          '/assets/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '',
          '/*',
          '  Cache-Control: public, max-age=0, must-revalidate',
          '',
        ].join('\n'),
      )
    },
  })
}

export function vercelAdapter(): WaldAdapter {
  return defineAdapter({
    name: 'vercel',
    outDir: '.vercel/output/static',
    adapt({ rootDir }) {
      writeFile(
        join(rootDir, '.vercel', 'output', 'config.json'),
        JSON.stringify(
          {
            version: 3,
            routes: [{ handle: 'filesystem' }],
            overrides: {
              'assets/**': {
                headers: {
                  'cache-control': 'public, max-age=31536000, immutable',
                },
              },
              '**/*.html': {
                headers: {
                  'cache-control': 'public, max-age=0, must-revalidate',
                },
              },
            },
          },
          null,
          2,
        ) + '\n',
      )
    },
  })
}

function writeFile(filePath: string, contents: string) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, contents)
}
