import { parse } from './parser/index.js'
import { VOID_ELEMENTS } from './void-elements.js'

export type FormatOptions = {
  /** Number of spaces per indentation level. Defaults to 2. */
  indentWidth?: number
  /** Indent with tabs instead of spaces. */
  useTabs?: boolean
}

type Token = {
  kind: 'open' | 'close' | 'self' | 'raw' | 'text' | 'expression' | 'markup'
  value: string
  name?: string
}

type FormatNode =
  | { kind: 'element'; open: Token; close?: Token; children: FormatNode[] }
  | { kind: 'leaf'; token: Token }

const RAW_ELEMENTS = new Set(['pre', 'script', 'style', 'textarea'])
const INLINE_ELEMENTS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'button', 'cite', 'code', 'data', 'del', 'dfn', 'em',
  'i', 'img', 'input', 'ins', 'kbd', 'label', 'mark', 'q', 's', 'samp', 'small', 'span',
  'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
])

/** Format a Wald single-file component. The result always ends in one newline. */
export function format(source: string, options: FormatOptions = {}): string {
  // Keep formatter errors consistent with the compiler's parser errors.
  parse(source)

  const normalized = source.replace(/\r\n?/g, '\n')
  const frontmatter = splitFrontmatter(normalized)
  const indentUnit = options.useTabs ? '\t' : ' '.repeat(options.indentWidth ?? 2)
  const template = renderChildren(buildTree(tokenize(frontmatter.template)), 0, indentUnit)

  const parts: string[] = []
  if (frontmatter.present) {
    parts.push('---')
    if (frontmatter.code) parts.push(frontmatter.code)
    parts.push('---')
  }
  if (template) parts.push(template)
  return `${parts.join('\n')}\n`
}

function splitFrontmatter(source: string): { present: boolean; code: string; template: string } {
  const trimmed = source.trimStart()
  if (!trimmed.startsWith('---')) return { present: false, code: '', template: source }

  const afterOpen = trimmed.slice(3)
  const end = afterOpen.indexOf('\n---')
  // parse() above has already produced the useful error for this case.
  if (end < 0) return { present: true, code: '', template: '' }

  return {
    present: true,
    code: trimBlankLines(afterOpen.slice(0, end)),
    template: afterOpen.slice(end + 4).replace(/^\s*\n?/, ''),
  }
}

function trimBlankLines(value: string): string {
  const lines = value.split('\n')
  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  return lines.map(line => line.replace(/[\t ]+$/, '')).join('\n')
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let pos = 0

  while (pos < source.length) {
    if (source.startsWith('<!--', pos)) {
      const end = source.indexOf('-->', pos + 4)
      const next = end < 0 ? source.length : end + 3
      tokens.push({ kind: 'markup', value: source.slice(pos, next).trim() })
      pos = next
      continue
    }

    if (source[pos] === '<') {
      const end = scanTagEnd(source, pos)
      const value = source.slice(pos, end)
      const closing = /^<\s*\//.test(value)
      const name = value.match(/^<\s*\/?\s*([\w-]+)/)?.[1]

      if (!name) {
        tokens.push({ kind: 'markup', value: value.trim() })
        pos = end
        continue
      }

      const lowerName = name.toLowerCase()
      if (!closing && RAW_ELEMENTS.has(lowerName)) {
        const closePattern = new RegExp(`<\\s*\\/\\s*${escapeRegExp(name)}\\s*>`, 'ig')
        closePattern.lastIndex = end
        const match = closePattern.exec(source)
        const rawEnd = match ? match.index + match[0].length : source.length
        tokens.push({ kind: 'raw', name, value: source.slice(pos, rawEnd).trim() })
        pos = rawEnd
        continue
      }

      const selfClosing = /\/\s*>$/.test(value) || VOID_ELEMENTS.has(lowerName)
      tokens.push({
        kind: closing ? 'close' : selfClosing ? 'self' : 'open',
        name,
        value: normalizeTag(value),
      })
      pos = end
      continue
    }

    if (source[pos] === '{') {
      const end = scanExpressionEnd(source, pos)
      tokens.push({ kind: 'expression', value: `{${source.slice(pos + 1, end - 1).trim()}}` })
      pos = end
      continue
    }

    let end = pos + 1
    while (end < source.length && source[end] !== '<' && source[end] !== '{') end++
    tokens.push({ kind: 'text', value: source.slice(pos, end) })
    pos = end
  }

  return tokens
}

function scanTagEnd(source: string, start: number): number {
  let quote = ''
  let braceDepth = 0
  for (let pos = start + 1; pos < source.length; pos++) {
    const char = source[pos]
    if (quote) {
      if (char === '\\') pos++
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '{') braceDepth++
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1)
    else if (char === '>' && braceDepth === 0) return pos + 1
  }
  return source.length
}

function scanExpressionEnd(source: string, start: number): number {
  let depth = 1
  let quote = ''
  for (let pos = start + 1; pos < source.length; pos++) {
    const char = source[pos]
    if (quote) {
      if (char === '\\') pos++
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') quote = char
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) return pos + 1
  }
  return source.length
}

function normalizeTag(tag: string): string {
  if (/^<\s*\//.test(tag)) {
    const name = tag.match(/^<\s*\/\s*([\w-]+)/)?.[1] ?? ''
    return `</${name}>`
  }

  let out = ''
  let pendingSpace = false
  let quote = ''
  let braceDepth = 0
  for (let pos = 0; pos < tag.length; pos++) {
    const char = tag[pos]
    if (quote) {
      out += char
      if (char === '\\' && pos + 1 < tag.length) out += tag[++pos]
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      if (pendingSpace && out && !/[\s=<]$/.test(out)) out += ' '
      pendingSpace = false
      quote = char
      out += char
    } else if (char === '{') {
      if (pendingSpace && out && !/[\s=<]$/.test(out)) out += ' '
      pendingSpace = false
      braceDepth++
      out += char
    } else if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1)
      out += char
    } else if (/\s/.test(char) && braceDepth === 0) {
      pendingSpace = true
    } else {
      if (pendingSpace && out && !/[\s=<]$/.test(out) && char !== '=' && char !== '>' && char !== '/') out += ' '
      pendingSpace = false
      out += char
    }
  }
  return out.replace(/\s*\/?>$/, ending => ending.includes('/') ? ' />' : '>')
}

function buildTree(tokens: Token[]): FormatNode[] {
  const root: FormatNode[] = []
  const stack: Array<{ kind: 'element'; open: Token; close?: Token; children: FormatNode[] }> = []
  const current = (): FormatNode[] => stack.at(-1)?.children ?? root

  for (const token of tokens) {
    if (token.kind === 'open') {
      const node = { kind: 'element' as const, open: token, children: [] }
      current().push(node)
      stack.push(node)
    } else if (token.kind === 'close') {
      const node = stack.at(-1)
      if (node && node.open.name?.toLowerCase() === token.name?.toLowerCase()) {
        node.close = token
        stack.pop()
      } else {
        current().push({ kind: 'leaf', token })
      }
    } else {
      current().push({ kind: 'leaf', token })
    }
  }
  return root
}

function renderChildren(nodes: FormatNode[], level: number, indentUnit: string): string {
  const meaningful = prepareChildren(nodes)
  const lines: string[] = []
  let inline = ''

  const flushInline = () => {
    const value = inline.trim()
    if (value) lines.push(indentUnit.repeat(level) + value)
    inline = ''
  }

  for (const node of meaningful) {
    if (isInline(node)) {
      inline += renderCompact(node)
    } else {
      flushInline()
      lines.push(renderBlock(node, level, indentUnit))
    }
  }
  flushInline()
  return lines.join('\n')
}

function renderBlock(node: FormatNode, level: number, indentUnit: string): string {
  const indent = indentUnit.repeat(level)
  if (node.kind === 'leaf') {
    if (node.token.kind === 'raw') return indent + node.token.value
    return indent + normalizeText(node.token.value).trim()
  }

  const children = prepareChildren(node.children)
  if (!node.close || children.length === 0) return indent + node.open.value + (node.close?.value ?? '')
  if (children.every(isInline)) return indent + node.open.value + children.map(renderCompact).join('') + node.close.value

  return [
    indent + node.open.value,
    renderChildren(children, level + 1, indentUnit),
    indent + node.close.value,
  ].filter(Boolean).join('\n')
}

function renderCompact(node: FormatNode): string {
  if (node.kind === 'leaf') {
    if (node.token.kind === 'text') return normalizeText(node.token.value)
    return node.token.value
  }
  return node.open.value + node.children.map(renderCompact).join('') + (node.close?.value ?? '')
}

function isInline(node: FormatNode): boolean {
  if (node.kind === 'leaf') {
    return node.token.kind === 'text' || node.token.kind === 'expression' || node.token.value.startsWith('<!--')
  }
  return INLINE_ELEMENTS.has(node.open.name?.toLowerCase() ?? '')
}

function prepareChildren(nodes: FormatNode[]): FormatNode[] {
  const result: FormatNode[] = []
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (node.kind !== 'leaf' || node.token.kind !== 'text' || node.token.value.trim() !== '') {
      result.push(node)
      continue
    }

    const previous = [...nodes.slice(0, index)].reverse().find(candidate => !isWhitespace(candidate))
    const next = nodes.slice(index + 1).find(candidate => !isWhitespace(candidate))
    if (previous && next && isInline(previous) && isInline(next)) {
      result.push({ kind: 'leaf', token: { kind: 'text', value: ' ' } })
    }
  }
  return result
}

function isWhitespace(node: FormatNode): boolean {
  return node.kind === 'leaf' && node.token.kind === 'text' && node.token.value.trim() === ''
}

function normalizeText(value: string): string {
  return value.includes('\n') ? value.replace(/\s+/g, ' ') : value
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
