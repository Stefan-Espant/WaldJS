import type { WaldDocument } from '../ast/types.js'
import { extractFrontmatter } from './frontmatter.js'
import { scanTemplate } from './scanner.js'

export function parse(source: string): WaldDocument {
  const { code, rest } = extractFrontmatter(source)
  const template = scanTemplate(rest)

  return {
    type: 'document',
    frontmatter: { type: 'frontmatter', code },
    template,
  }
}
