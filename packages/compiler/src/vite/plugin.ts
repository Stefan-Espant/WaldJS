import type { Plugin } from 'vite'
import { compile } from '../compile.js'

export function waldPlugin(): Plugin {
  return {
    name: 'vite-plugin-wald',

    resolveId(id) {
      if (id.endsWith('.wald')) return id
    },

    transform(code, id) {
      if (!id.endsWith('.wald')) return
      return compile(code, id)
    },
  }
}
