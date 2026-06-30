import type { Plugin } from 'vite'
import { compile } from '../compile.js'
import { join } from 'node:path'

const VIRTUAL_CONTENT_ID = '\0wald:content'

export function waldPlugin(): Plugin[] {
  return [
    {
      name: 'vite-plugin-wald',

      resolveId(id) {
        if (id.endsWith('.wald')) return id
      },

      transform(code, id) {
        if (!id.endsWith('.wald')) return
        return compile(code, id)
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
  ]
}
