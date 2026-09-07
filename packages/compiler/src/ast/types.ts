export type WaldDocument = {
  type: 'document'
  frontmatter: FrontmatterNode
  template: TemplateNode[]
  // Optional (not required) so the ~20 hand-written WaldDocument literals in
  // transform/index.test.ts that predate this feature keep compiling as-is —
  // transformWithMap() treats a missing field the same as `null`.
  styles?: string | null
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
  | StyleNode

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
  canopy?: {
    strategy: 'load' | 'idle' | 'visible'
  }
}

export type ScriptNode = {
  type: 'script'
  content: string
}

export type StyleNode = {
  type: 'style'
  content: string
  line: number
  column: number
}
