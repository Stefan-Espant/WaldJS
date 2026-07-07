import { compile, parse, type ScriptNode } from '@waldjs/compiler'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { transformWithEsbuild } from 'vite'

const VIRTUAL_CONTENT_ID = '\0wald:content'
const CANOPY_SCRIPT_SUFFIX = '.wald?canopy-script'

export function waldPlugin(): Plugin[] {
  return [
    {
      name: 'vite-plugin-wald',

      resolveId(id) {
        if (id.endsWith('.wald')) return id
      },

      async transform(code, id) {
        if (!id.endsWith('.wald')) return
        try {
          const compiled = compile(code, id)
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
    },
    {
      name: 'vite-plugin-wald-content',

      resolveId(id) {
        if (id === 'wald:content') return VIRTUAL_CONTENT_ID
      },

      load(id) {
        if (id !== VIRTUAL_CONTENT_ID) return
        const contentDir = JSON.stringify(join(process.cwd(), 'content'))
        return [
          `import { readCollection as _rc, readEntry as _re } from '@waldjs/content'`,
          `const contentDir = ${contentDir}`,
          `export const getCollection = (name) => _rc(name, contentDir)`,
          `export const getEntry = (collection, slug) => _re(collection, slug, contentDir)`,
        ].join('\n')
      },
    },
    {
      name: 'vite-plugin-wald-canopy-script',

      resolveId(id) {
        if (id.endsWith(CANOPY_SCRIPT_SUFFIX)) return '\0' + id
      },

      load(id) {
        if (!id.startsWith('\0') || !id.endsWith(CANOPY_SCRIPT_SUFFIX)) return
        const file = id.slice(1, -'?canopy-script'.length)
        const source = readFileSync(file, 'utf8')
        const ast = parse(source)
        const scriptNode = ast.template.find((node): node is ScriptNode => node.type === 'script')
        if (!scriptNode) return 'export default function() {}'
        return scriptNode.content.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')
      },
    },
  ]
}
