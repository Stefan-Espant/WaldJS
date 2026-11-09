import { parse } from './parser/index.js'
import { VOID_ELEMENTS } from './void-elements.js'
import type { Options as PrettierOptions } from 'prettier'

export type FormatOptions = {
  /** Number of spaces per indentation level. Defaults to 2. */
  indentWidth?: number
  /** Indent with tabs instead of spaces. */
  useTabs?: boolean
  /** Preferred line length. Unbreakable values may exceed it. Defaults to 80. */
  printWidth?: number
}

type Token = {
  kind: 'open' | 'close' | 'self' | 'raw' | 'text' | 'expression' | 'markup'
  value: string
  name?: string
  formatted?: boolean
}

type RenderSettings = { indentUnit: string; printWidth: number }

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
  return renderDocument(frontmatter, buildTree(tokenize(frontmatter.template)), options)
}

function renderDocument(frontmatter: ReturnType<typeof splitFrontmatter>, nodes: FormatNode[], options: FormatOptions): string {
  const indentUnit = options.useTabs ? '\t' : ' '.repeat(options.indentWidth ?? 2)
  const template = renderChildren(nodes, 0, { indentUnit, printWidth: options.printWidth ?? 80 })

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

function renderChildren(nodes: FormatNode[], level: number, settings: RenderSettings): string {
  const lines: string[] = []
  let inline: FormatNode[] = []
  const flushInline = () => {
    if (inline.length) lines.push(renderInline(inline, level, settings))
    inline = []
  }
  for (const node of prepareChildren(nodes)) {
    if (isInline(node)) inline.push(node)
    else {
      flushInline()
      lines.push(renderBlock(node, level, settings))
    }
  }
  flushInline()
  return lines.filter(Boolean).join('\n')
}

// A newline can replace an existing text-space, but must never be inserted
// between adjacent inline elements: <span>one</span><span>two</span> stays joined.
function renderInline(nodes: FormatNode[], level: number, settings: RenderSettings, initial?: string): string {
  const indent = settings.indentUnit.repeat(level)
  let result = initial ?? ''
  let gap = ''
  const append = (value: string) => {
    if (!value) return
    if (!result) result = indent + value
    else {
      const line = result.slice(result.lastIndexOf('\n') + 1)
      const firstLine = value.split('\n', 1)[0]
      result += gap && (value.includes('\n') || line.length + gap.length + firstLine.length > settings.printWidth)
        ? '\n' + indent + value : gap + value
    }
    gap = ''
  }
  for (const node of nodes) {
    if (node.kind === 'leaf' && node.token.kind === 'text') {
      for (const part of normalizeText(node.token.value).split(/(\s+)/)) {
        if (/^\s+$/.test(part)) gap += part
        else append(part)
      }
    } else append(renderCompact(node, level, settings))
  }
  return initial === undefined ? result.trimEnd() : result + gap
}

function renderBlock(node: FormatNode, level: number, settings: RenderSettings): string {
  const indent = settings.indentUnit.repeat(level)
  if (node.kind === 'leaf') {
    if (node.token.kind === 'raw') return node.token.formatted ? node.token.value : indent + node.token.value
    if (node.token.kind === 'self') return indent + renderTag(node.token.value, level, settings)
    return indent + normalizeText(node.token.value).trim()
  }

  const opening = renderTag(node.open.value, level, settings)
  const children = prepareChildren(node.children)
  if (!node.close || children.length === 0) return indent + opening + (node.close?.value ?? '')
  if (children.every(isInline)) {
    const compact = indent + opening + children.map(child => renderCompact(child, level + 1, settings)).join('') + node.close.value
    if (!compact.includes('\n') && compact.length <= settings.printWidth) return compact
  }

  return [
    indent + opening,
    renderChildren(children, level + 1, settings),
    indent + node.close.value,
  ].filter(Boolean).join('\n')
}

function renderCompact(node: FormatNode, level: number, settings: RenderSettings): string {
  if (node.kind === 'leaf') {
    if (node.token.kind === 'text') return normalizeText(node.token.value)
    if (node.token.kind === 'self') return renderTag(node.token.value, level, settings)
    return node.token.formatted ? node.token.value.trimStart() : node.token.value
  }
  const opening = renderTag(node.open.value, level, settings)
  const body = node.open.name?.toLowerCase() === 'code'
    ? opening + node.children.map(child => renderCompact(child, level + 1, settings)).join('')
    : renderInline(node.children, level + 1, settings, opening)
  return body + (node.close?.value ?? '')
}

function renderTag(value: string, level: number, settings: RenderSettings): string {
  const indent = settings.indentUnit.repeat(level)
  if (indent.length + value.length <= settings.printWidth && !value.includes('\n')) return value
  const name = value.match(/^<[^\s/>]+/)?.[0]
  if (!name) return value
  const ending = value.endsWith('/>') ? '/>' : '>'
  const body = value.slice(name.length, -ending.length).trim()
  const attrs: string[] = []
  let start = 0
  let quote = ''
  let depth = 0
  for (let pos = 0; pos <= body.length; pos++) {
    const char = body[pos]
    if (quote) {
      if (char === '\\') pos++
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'" || char === '`') quote = char
    else if (char === '{') depth++
    else if (char === '}') depth--
    else if (depth === 0 && (pos === body.length || /\s/.test(char))) {
      const attr = body.slice(start, pos).trim()
      if (attr) attrs.push(attr)
      start = pos + 1
    }
  }
  if (attrs.length === 0) return value
  return [name, ...attrs.map(attr => indent + settings.indentUnit + attr), indent + ending].join('\n')
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

/** File types supported by the asynchronous, language-aware formatter. */
export const FORMAT_EXTENSIONS = ['.wald', '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx'] as const

/** Format a Wald component (including embedded code) or a standalone web source file. */
export async function formatFile(source: string, filename: string, options: FormatOptions = {}): Promise<string> {
  const extension = filename.match(/\.[^./\\]+$/)?.[0].toLowerCase()
  if (!FORMAT_EXTENSIONS.some(value => value === extension)) {
    throw new Error(`Unsupported formatter file: ${filename}`)
  }
  const prettier = await import('prettier')
  const settings: PrettierOptions = {
    tabWidth: options.indentWidth ?? 2,
    useTabs: options.useTabs ?? false,
    singleQuote: true,
    semi: false,
    endOfLine: 'lf',
    printWidth: options.printWidth ?? 80,
  }
  if (extension !== '.wald') {
    return prettier.format(source, { ...settings, filepath: filename })
  }

  parse(source)
  const frontmatter = splitFrontmatter(source.replace(/\r\n?/g, '\n'))
  if (frontmatter.code) {
    frontmatter.code = (await prettier.format(frontmatter.code, { ...settings, parser: 'typescript' })).trimEnd()
  }
  const nodes = buildTree(tokenize(frontmatter.template))
  const indentUnit = options.useTabs ? '\t' : ' '.repeat(options.indentWidth ?? 2)
  const visit = async (nodes: FormatNode[], level: number): Promise<void> => {
    for (const node of nodes) {
      if (node.kind === 'element') {
        await visit(node.children, level + 1)
        continue
      }
      const token = node.token
      const name = token.name?.toLowerCase()
      if (token.kind !== 'raw' || (name !== 'script' && name !== 'style')) continue
      const openingEnd = scanTagEnd(token.value, 0)
      const closingStart = token.value.lastIndexOf('</')
      if (closingStart < openingEnd) continue
      const opening = token.value.slice(0, openingEnd)
      const content = token.value.slice(openingEnd, closingStart)
      if (!content.trim()) continue
      const type = attributeValue(opening, 'type').toLowerCase()
      const lang = attributeValue(opening, 'lang').toLowerCase()
      let parser: string
      let safeOpening: string
      if (name === 'style') {
        if ((type && type !== 'text/css') || (lang && lang !== 'css')) continue
        parser = 'css'
        safeOpening = '<style>'
      } else if (['application/json', 'application/ld+json', 'importmap', 'speculationrules'].includes(type)) {
        parser = 'json'
        safeOpening = '<script type="application/json">'
      } else {
        if (!['', 'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript', 'text/typescript'].includes(type)) continue
        if (lang && !['js', 'javascript', 'ts', 'typescript'].includes(lang)) continue
        // Match the canopy builder's TypeScript loader, including scripts
        // without an explicit lang attribute. JavaScript is accepted too.
        parser = 'typescript'
        safeOpening = '<script lang="ts">'
      }
      const code = await prettier.format(content, { ...settings, parser })
      // Let Prettier indent embedded code in its HTML context. Prefixing each
      // line ourselves would change multiline strings and template literals.
      const wrapped = '<div>'.repeat(level) + safeOpening + code + `</${name}>` + '</div>'.repeat(level)
      const html = await prettier.format(wrapped, { ...settings, parser: 'html', htmlWhitespaceSensitivity: 'ignore' })
      const start = html.indexOf(`<${name}`)
      const body = html.slice(html.indexOf('>', start) + 1, html.lastIndexOf(`</${name}>`))
      token.value = indentUnit.repeat(level) + normalizeTag(opening) + body + token.value.slice(closingStart)
      token.formatted = true
    }
  }
  await visit(nodes, 0)
  return renderDocument(frontmatter, nodes, options)
}

function attributeValue(opening: string, name: string): string {
  const match = opening.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? ''
}
