import { compileWithMap } from '@waldjs/compiler'
import { readFileSync } from 'node:fs'
import { walkWaldFiles } from './canopy-scan.js'

/** Bundles every component's scoped CSS into one string. Scanning source
 * files directly (like canopy-scan.ts does for islands) keeps this
 * independent of whether a page actually imports a given component at
 * runtime — simpler than tracking a per-page usage graph, and harmless: an
 * unused component's scoped rule just never matches anything in the DOM. */
export function collectComponentStyles(srcDir: string): string {
  const parts: string[] = []
  for (const file of walkWaldFiles(srcDir)) {
    const { styles } = compileWithMap(readFileSync(file, 'utf8'), file)
    if (styles) parts.push(styles)
  }
  return parts.join('\n')
}
