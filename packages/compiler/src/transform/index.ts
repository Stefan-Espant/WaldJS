import type { WaldDocument, TemplateNode, ElementNode, AttributeNode } from '../ast/types.js'

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
])

export function transform(ast: WaldDocument): string {
  const templateCode = renderNodes(ast.template)
  const frontmatter = ast.frontmatter.code
    ? ast.frontmatter.code.split('\n').map(line => `  ${line}`).join('\n')
    : ''

  return [
    `import { createTree, renderTemplate } from '@waldjs/runtime'`,
    ``,
    `export default createTree(async ($$result, $$props) => {`,
    frontmatter,
    ``,
    `  return renderTemplate\`${templateCode}\``,
    `})`,
  ].join('\n')
}

function renderNodes(nodes: TemplateNode[]): string {
  return nodes.map(renderNode).join('')
}

function renderNode(node: TemplateNode): string {
  switch (node.type) {
    case 'element': return renderElement(node)
    case 'text': return escapeTemplateLiteral(node.value)
    case 'expression': return `\${${node.code}}`
    case 'component': return ''
  }
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
