import type { WaldDocument, TemplateNode, ElementNode, ComponentNode, AttributeNode } from '../ast/types.js'
import { VOID_ELEMENTS } from '../void-elements.js'

type MappedLine = { text: string; srcLine: number }

export function transform(ast: WaldDocument): string {
  return transformWithMap(ast).code
}

/** lineMap[i] is the 1-based .wald source line for output line i + 1, or null for generated lines. */
export type LineMap = (number | null)[]

export type TransformResult = { code: string; lineMap: LineMap }

export function transformWithMap(ast: WaldDocument): TransformResult {
  const templateCode = renderNodes(ast.template)
  const code = ast.frontmatter.code ?? ''
  const fmStart = ast.frontmatter.line ?? 2
  const { hoisted, body, hasProps } = splitFrontmatter(code)

  const out: string[] = []
  const map: (number | null)[] = []
  const push = (text: string, src: number | null) => {
    out.push(text)
    map.push(src)
  }
  const pushGenerated = (text: string) => {
    for (const line of text.split('\n')) push(line, null)
  }

  push(`import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'`, null)
  push(``, null)

  if (hoisted.length > 0) {
    for (const l of hoisted) push(l.text, l.srcLine + fmStart - 1)
    push(``, null)
  }

  push(
    hasProps
      ? `export default createTree<Props>(async ($$result, $$props: Props) => {`
      : `export default createTree(async ($$result, $$props) => {`,
    null,
  )

  if (hasProps) {
    push(`  const $props = $$props`, null)
    for (const l of body) push(`  ${l.text}`, l.srcLine + fmStart - 1)
  } else if (body.length > 0) {
    for (const l of body) push(`  ${l.text}`, l.srcLine + fmStart - 1)
  } else {
    push(``, null)
  }

  push(``, null)
  pushGenerated(`  return renderTemplate\`${templateCode}\``)
  push(`})`, null)

  return { code: out.join('\n'), lineMap: map }
}

function splitFrontmatter(code: string): { hoisted: MappedLine[]; body: MappedLine[]; hasProps: boolean } {
  const lines = code.split('\n')
  const hoisted: MappedLine[] = []
  const body: MappedLine[] = []
  let hasProps = false
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trimStart()
    if (trimmed.startsWith('import ')) {
      // import statements are always single-line in frontmatter
      hoisted.push({ text: lines[i], srcLine: i + 1 })
      i++
    } else if (/^(?:export\s+)?type Props\s*=/.test(trimmed)) {
      // collect until balanced braces, or just the first line if no braces present
      let depth = 0
      do {
        const line = lines[i]
        hoisted.push({ text: line, srcLine: i + 1 })
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
        i++
      } while (depth > 0 && i < lines.length)
      hasProps = true
    } else if (trimmed.startsWith('export ')) {
      // export blocks may span multiple lines — collect until balanced braces
      let depth = 0
      do {
        const line = lines[i]
        hoisted.push({ text: line, srcLine: i + 1 })
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
        i++
      } while (depth > 0 && i < lines.length)
    } else {
      body.push({ text: lines[i], srcLine: i + 1 })
      i++
    }
  }

  // Reproduce the old body.join('\n').trim() behavior line-by-line:
  // drop whitespace-only lines at both ends, strip edge whitespace of the
  // first and last kept line.
  while (body.length > 0 && body[0].text.trim() === '') body.shift()
  while (body.length > 0 && body[body.length - 1].text.trim() === '') body.pop()
  if (body.length > 0) {
    body[0] = { ...body[0], text: body[0].text.trimStart() }
    const last = body.length - 1
    body[last] = { ...body[last], text: body[last].text.trimEnd() }
  }

  return { hoisted, body, hasProps }
}

function renderNodes(nodes: TemplateNode[]): string {
  return nodes.map(renderNode).join('')
}

function renderNode(node: TemplateNode): string {
  switch (node.type) {
    case 'element': return renderElement(node)
    case 'text': return escapeTemplateLiteral(node.value)
    case 'expression': return `\${${node.code}}`
    case 'component': return renderComponent(node)
    case 'script': return `\${new SafeHtml(${JSON.stringify(node.content)})}`
  }
}

function renderComponent(node: ComponentNode): string {
  const props = node.attrs
    .map(attr =>
      typeof attr.value === 'string'
        ? `${attr.name}: ${JSON.stringify(attr.value)}`
        : `${attr.name}: (${attr.value.code})`
    )
    .join(', ')

  if (node.children.length > 0) {
    const childrenHtml = renderNodes(node.children)
    const propsWithPond = props
      ? `${props}, pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
      : `pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
    return `\${new SafeHtml(await ${node.name}.render({ ${propsWithPond} }))}`
  }

  return `\${new SafeHtml(await ${node.name}.render({ ${props} }))}`
}

function escapeTemplateLiteral(text: string): string {
  return text.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

function renderElement(node: ElementNode): string {
  const attrs = node.attrs.map(renderAttr).join(' ')
  const attrsStr = attrs ? ` ${attrs}` : ''

  if (VOID_ELEMENTS.has(node.tag)) {
    return `<${node.tag}${attrsStr}>`
  }

  const children = renderNodes(node.children)
  return `<${node.tag}${attrsStr}>${children}</${node.tag}>`
}

function renderAttr(attr: AttributeNode): string {
  if (typeof attr.value === 'string') {
    return attr.value ? `${attr.name}="${attr.value}"` : attr.name
  }
  return `${attr.name}="\${${attr.value.code}}"`
}
