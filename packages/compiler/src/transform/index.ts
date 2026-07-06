import type { WaldDocument, TemplateNode, ElementNode, ComponentNode, AttributeNode } from '../ast/types.js'
import { VOID_ELEMENTS } from '../void-elements.js'

export function transform(ast: WaldDocument): string {
  const templateCode = renderNodes(ast.template)
  const code = ast.frontmatter.code ?? ''
  const { hoisted, body, hasProps } = extractExports(code)

  const bodyIndented = body
    ? body.split('\n').map(line => `  ${line}`).join('\n')
    : ''

  const parts = [
    `import { createTree, renderTemplate, SafeHtml } from '@waldjs/runtime'`,
    ``,
  ]

  if (hoisted) {
    parts.push(hoisted)
    parts.push(``)
  }

  const fnSignature = hasProps
    ? `export default createTree<Props>(async ($$result, $$props: Props) => {`
    : `export default createTree(async ($$result, $$props) => {`

  const bodyContent = hasProps
    ? [`  const $props = $$props`, bodyIndented].filter(Boolean).join('\n')
    : bodyIndented

  parts.push(
    fnSignature,
    bodyContent,
    ``,
    `  return renderTemplate\`${templateCode}\``,
    `})`,
  )

  return parts.join('\n')
}

function extractExports(code: string): { hoisted: string; body: string; hasProps: boolean } {
  const lines = code.split('\n')
  const hoistedBlocks: string[] = []
  const bodyLines: string[] = []
  let hasProps = false
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trimStart()
    if (trimmed.startsWith('import ')) {
      // import statements are always single-line in frontmatter
      hoistedBlocks.push(lines[i])
      i++
    } else if (/^(?:export\s+)?type Props\s*=/.test(trimmed)) {
      // collect until balanced braces, or just the first line if no braces present
      const block: string[] = []
      let depth = 0
      do {
        const line = lines[i]
        block.push(line)
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
        i++
      } while (depth > 0 && i < lines.length)
      hoistedBlocks.push(block.join('\n'))
      hasProps = true
    } else if (trimmed.startsWith('export ')) {
      // export blocks may span multiple lines — collect until balanced braces
      const block: string[] = []
      let depth = 0
      do {
        const line = lines[i]
        block.push(line)
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
        i++
      } while (depth > 0 && i < lines.length)
      hoistedBlocks.push(block.join('\n'))
    } else {
      bodyLines.push(lines[i])
      i++
    }
  }

  return {
    hoisted: hoistedBlocks.join('\n'),
    body: bodyLines.join('\n').trim(),
    hasProps,
  }
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
