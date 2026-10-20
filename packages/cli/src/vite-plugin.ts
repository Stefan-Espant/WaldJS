import { compile, parse, type ScriptNode } from '@waldjs/compiler'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HmrContext, Plugin } from 'vite'
import { transformWithEsbuild } from 'vite'
import { WALD_GENERATOR } from './version.js'
import { WALD_RUNTIME_PACKAGES, contentModuleSource, imageModuleSource, resolveWaldPackage } from './wald-modules.js'

export { WALD_RUNTIME_PACKAGES, contentModuleSource, imageModuleSource, resolveWaldPackage }

const VIRTUAL_CONTENT_ID = '\0wald:content'
const VIRTUAL_IMAGE_ID = '\0wald:image'
const CANOPY_SCRIPT_SUFFIX = '.wald?canopy-script'
// These 3 packages are vendored via the CLI, not meant to be direct project
// dependencies — a scaffolded package.json only ever lists '@waldjs/cli'.
// Listing one here means it *always* resolves to the CLI's own co-located
// copy below, for every project, even if a project's own node_modules has
// something under the same name — that's intentional, not just a fallback.

// wald grow renders every page fresh per HTTP request via ssrLoadModule(), so
// edited .wald/content modules only ever live in Vite's *ssr* module graph —
// Vite's default HMR propagation walks the *client* graph to decide who to
// notify, so it never reaches the browser on its own. We tell it explicitly.
function needsFullReload(file: string): boolean {
  return file.endsWith('.wald') || file.includes(`${sep}content${sep}`)
}

export type WaldPluginOptions = {
  // Set only by `wald build` — its presence is what tells the `wald:image`
  // virtual module whether to actually optimize images (build) or just pass
  // the original file through untouched (dev, via wald grow's existing
  // /assets/* static serving).
  image?: { outDir: string; publicPath: string }
}

export function waldPlugin(options: WaldPluginOptions = {}): Plugin[] {
  return [
    {
      name: 'vite-plugin-wald',

      resolveId(id) {
        if (id.endsWith('.wald')) return id
        if (WALD_RUNTIME_PACKAGES.has(id)) return resolveWaldPackage(id)
      },

      async transform(code, id) {
        if (!id.endsWith('.wald')) return
        try {
          const compiled = compile(code, id, { generator: WALD_GENERATOR })
          const { code: stripped, map } = await transformWithEsbuild(compiled, `${id}.ts`, { loader: 'ts' })
          return { code: stripped, map }
        } catch (e) {
          const message = `[waldjs] ${e instanceof Error ? e.message : String(e)}`
          const loc = typeof e === 'object' && e !== null && 'line' in e
            ? {
                line: (e as { line: number }).line,
                column: 'column' in e ? (e as { column: number }).column - 1 : 0,
              }
            : undefined
          this.error({ message, loc })
        }
      },

      handleHotUpdate(ctx: HmrContext) {
        if (!needsFullReload(ctx.file)) return
        ctx.server.ws.send({ type: 'full-reload' })
        return []
      },
    },
    {
      name: 'vite-plugin-wald-content',

      resolveId(id) {
        if (id === 'wald:content') return VIRTUAL_CONTENT_ID
      },

      load(id) {
        if (id !== VIRTUAL_CONTENT_ID) return
        return contentModuleSource(process.cwd())
      },
    },
    {
      name: 'vite-plugin-wald-image',

      resolveId(id) {
        if (id === 'wald:image') return VIRTUAL_IMAGE_ID
      },

      load(id) {
        if (id !== VIRTUAL_IMAGE_ID) return
        return imageModuleSource(process.cwd(), options.image)
      },
    },
    {
      name: 'vite-plugin-wald-canopy-script',

      resolveId(id) {
        if (id.endsWith(CANOPY_SCRIPT_SUFFIX)) return '\0' + id
      },

      load(id) {
        if (!id.endsWith(CANOPY_SCRIPT_SUFFIX)) return
        const file = id.startsWith('\0')
          ? id.slice(1, -'?canopy-script'.length)
          : id.slice(0, -'?canopy-script'.length)
        const source = readFileSync(file, 'utf8')
        const ast = parse(source)
        const scriptNode = ast.template.find((node): node is ScriptNode => node.type === 'script')
        if (!scriptNode) return 'export default function() {}'
        return scriptNode.content.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
      },
    },
  ]
}
