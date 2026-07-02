export type WaldDocument = {
  type: 'document'
  frontmatter: FrontmatterNode
  template: TemplateNode[]
}

export type FrontmatterNode = {
  type: 'frontmatter'
  code: string
  line?: number
}

export type TemplateNode =
  | ElementNode
  | TextNode
  | ExpressionNode
  | ComponentNode
  | ScriptNode

export type ElementNode = {
  type: 'element'
  tag: string
  attrs: AttributeNode[]
  children: TemplateNode[]
}

export type TextNode = {
  type: 'text'
  value: string
}

export type ExpressionNode = {
  type: 'expression'
  code: string
}

export type AttributeNode = {
  type: 'attribute'
  name: string
  value: string | ExpressionNode
}

export type ComponentNode = {
  type: 'component'
  name: string
  attrs: AttributeNode[]
  children: TemplateNode[]
}

export type ScriptNode = {
  type: 'script'
  content: string
}
