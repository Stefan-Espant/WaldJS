import type { WaldDocument, TemplateNode, ElementNode, ComponentNode, AttributeNode } from '../ast/types.js'

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

export function transform(ast: WaldDocument): string {
  const templateCode = renderNodes(ast.template)
  const code = ast.frontmatter.code ?? ''
  const { hoisted, body } = extractExports(code)

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

  parts.push(
    `export default createTree(async ($$result, $$props) => {`,
    bodyIndented,
    ``,
    `  return renderTemplate\`${templateCode}\``,
    `})`,
  )

  return parts.join('\n')
}

function extractExports(code: string): { hoisted: string; body: string } {
  const lines = code.split('\n')
  const hoistedBlocks: string[] = []
  const bodyLines: string[] = []
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trimStart()
    if (trimmed.startsWith('import ')) {
      // import statements are always single-line in frontmatter
      hoistedBlocks.push(lines[i])
      i++
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
