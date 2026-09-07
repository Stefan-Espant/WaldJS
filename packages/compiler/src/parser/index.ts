import type { WaldDocument, TemplateNode, StyleNode } from '../ast/types.js'
import { extractFrontmatter } from './frontmatter.js'
import { scanTemplate } from './scanner.js'
import { WaldError } from '../errors.js'

export function parse(source: string): WaldDocument {
  const { code, rest, line } = extractFrontmatter(source)
  const scanned = scanTemplate(rest)
  const { template, styles } = extractStyles(scanned)

  return {
    type: 'document',
    frontmatter: { type: 'frontmatter', code, line },
    template,
    styles,
  }
}

function extractStyles(nodes: TemplateNode[]): { template: TemplateNode[]; styles: string | null } {
  const found: StyleNode[] = []
  const template = stripStyles(nodes, found)
  if (found.length > 1) {
    throw new WaldError('A .wald file can only have one <style> block', found[1].line, found[1].column)
  }
  return { template, styles: found.length === 1 ? found[0].content : null }
}

function stripStyles(nodes: TemplateNode[], found: StyleNode[]): TemplateNode[] {
  const kept: TemplateNode[] = []
  for (const node of nodes) {
    if (node.type === 'style') {
      found.push(node)
    } else if (node.type === 'element') {
      kept.push({ ...node, children: stripStyles(node.children, found) })
    } else if (node.type === 'component') {
      kept.push({ ...node, children: stripStyles(node.children, found) })
    } else {
      kept.push(node)
    }
  }
  return kept
}
