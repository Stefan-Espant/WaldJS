import type { WaldDocument, TemplateNode, ElementNode, ComponentNode, AttributeNode } from '../ast/types.js'
import { VOID_ELEMENTS } from '../void-elements.js'
import { scopeCss, scopeHash } from '../scope-css.js'

type MappedLine = { text: string; srcLine: number }

export function transform(ast: WaldDocument, fileId = ''): string {
  return transformWithMap(ast, fileId).code
}

/** lineMap[i] is the 1-based .wald source line for output line i + 1, or null for generated lines. */
export type LineMap = (number | null)[]

export type TransformResult = { code: string; lineMap: LineMap; styles: string | null }

export function transformWithMap(ast: WaldDocument, fileId = ''): TransformResult {
  const hasStyles = (ast.styles ?? null) !== null
  const hash = hasStyles ? scopeHash(fileId) : null
  const scopeAttr = hash !== null ? ` data-wald-${hash}` : ''
  const styles = hash !== null ? scopeCss(ast.styles as string, hash) : null

  const templateCode = renderNodes(ast.template, scopeAttr)
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

  return { code: out.join('\n'), lineMap: map, styles }
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

function renderNodes(nodes: TemplateNode[], scopeAttr: string): string {
  return nodes.map(node => renderNode(node, scopeAttr)).join('')
}

function renderNode(node: TemplateNode, scopeAttr: string): string {
  switch (node.type) {
    case 'element': return renderElement(node, scopeAttr)
    case 'text': return escapeTemplateLiteral(node.value)
    case 'expression': return `\${${node.code}}`
    case 'component': return renderComponent(node, scopeAttr)
    case 'script': return `\${new SafeHtml(${JSON.stringify(node.content)})}`
    // Never actually reached — parser/index.ts lifts every StyleNode out of
    // the tree before it gets here. Handled for switch exhaustiveness.
    case 'style': return ''
  }
}

function renderComponent(node: ComponentNode, scopeAttr: string): string {
  const props = node.attrs
    .map(attr =>
      typeof attr.value === 'string'
        ? `${attr.name}: ${JSON.stringify(attr.value)}`
        : `${attr.name}: (${attr.value.code})`
    )
    .join(', ')
  const propsObj = `{ ${props} }`

  if (node.canopy) {
    const src = `wald:canopy:${node.name}`
    return `\${new SafeHtml('<wald-canopy data-src="${src}" data-strategy="${node.canopy.strategy}" data-props=\\'' + JSON.stringify(${propsObj}) + '\\'>' + await ${node.name}.render(${propsObj}) + '</wald-canopy>')}`
  }

  if (node.children.length > 0) {
    const childrenHtml = renderNodes(node.children, scopeAttr)
    const propsWithPond = props
      ? `${props}, pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
      : `pond: new SafeHtml(renderTemplate\`${childrenHtml}\`)`
    return `\${new SafeHtml(await ${node.name}.render({ ${propsWithPond} }))}`
  }

  return `\${new SafeHtml(await ${node.name}.render(${propsObj}))}`
}

function escapeTemplateLiteral(text: string): string {
  return text.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

function renderElement(node: ElementNode, scopeAttr: string): string {
  const attrs = node.attrs.map(renderAttr).join(' ')
  const attrsStr = `${attrs ? ` ${attrs}` : ''}${scopeAttr}`

  if (VOID_ELEMENTS.has(node.tag)) {
    return `<${node.tag}${attrsStr}>`
  }

  const children = renderNodes(node.children, scopeAttr)
  return `<${node.tag}${attrsStr}>${children}</${node.tag}>`
}

function renderAttr(attr: AttributeNode): string {
  if (typeof attr.value === 'string') {
    return attr.value ? `${attr.name}="${attr.value}"` : attr.name
  }
  return `${attr.name}="\${${attr.value.code}}"`
}
