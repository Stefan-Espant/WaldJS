import type { TemplateNode, ElementNode, ComponentNode, AttributeNode, ScriptNode } from '../ast/types.js'
import { WaldError, offsetToLineCol } from '../errors.js'
import { VOID_ELEMENTS } from '../void-elements.js'

export function scanTemplate(source: string): TemplateNode[] {
  const scanner = new Scanner(source)
  return scanner.scanNodes()
}

class Scanner {
  private pos = 0

  constructor(private source: string) {}

  private get current(): string {
    return this.source[this.pos] ?? ''
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? ''
  }

  private advance(): string {
    return this.source[this.pos++] ?? ''
  }

  scanNodes(): TemplateNode[] {
    const nodes: TemplateNode[] = []
    while (this.pos < this.source.length) {
      if (this.current === '<' && this.peek(1) === '/') break
      const node = this.scanNode()
      if (node !== null) nodes.push(node)
    }
    return nodes
  }

  private scanNode(): TemplateNode | null {
    if (this.current === '<' && this.peek(1) === '!') {
      return this.scanRawMarkup()
    }
    if (this.current === '<' && this.peek(1) !== '/') {
      if (this.isScriptTag()) return this.scanScript()
      return this.scanElement()
    }
    if (this.current === '{') {
      return this.scanExpression()
    }
    return this.scanText()
  }

  private isScriptTag(): boolean {
    const ahead = this.source.slice(this.pos + 1, this.pos + 8).toLowerCase()
    return ahead.startsWith('script') && /[\s>/]/.test(ahead[6] ?? '>')
  }

  private scanScript(): ScriptNode {
    const closeTag = '</script>'
    const closeIndex = this.source.toLowerCase().indexOf(closeTag, this.pos)
    const end = closeIndex === -1 ? this.source.length : closeIndex + closeTag.length
    const content = this.source.slice(this.pos, end)
    this.pos = end
    return { type: 'script', content }
  }

  // <!DOCTYPE ...> and <!-- comments --> pass through as literal text.
  private scanRawMarkup(): TemplateNode {
    const start = this.pos
    if (this.source.startsWith('<!--', this.pos)) {
      const close = this.source.indexOf('-->', this.pos + 4)
      this.pos = close === -1 ? this.source.length : close + 3
    } else {
      while (this.pos < this.source.length && this.current !== '>') this.advance()
      if (this.pos < this.source.length) this.advance() // consume >
    }
    return { type: 'text', value: this.source.slice(start, this.pos) }
  }

  private scanText(): TemplateNode | null {
    let value = ''
    while (this.pos < this.source.length && this.current !== '<' && this.current !== '{') {
      value += this.advance()
    }
    if (!value) return null
    return { type: 'text', value }
  }

  scanExpression(): TemplateNode {
    const openPos = this.pos
    this.advance() // consume {
    let code = ''
    let depth = 1
    while (this.pos < this.source.length && depth > 0) {
      const ch = this.advance()
      if (ch === '{') depth++
      else if (ch === '}') depth--
      if (depth > 0) code += ch
    }
    if (depth > 0) {
      const { line, column } = offsetToLineCol(this.source, openPos)
      throw new WaldError(`Unclosed expression: expected '}'`, line, column)
    }
    return { type: 'expression', code: code.trim() }
  }

  private scanElement(): ElementNode | ComponentNode {
    const openPos = this.pos
    this.advance() // consume <
    const tag = this.scanIdentifier()
    const attrs = this.scanAttributes()
    const canopy = /^[A-Z]/.test(tag) ? this.extractCanopy(tag, attrs, openPos) : undefined

    if (this.pos >= this.source.length) {
      const { line, column } = offsetToLineCol(this.source, openPos)
      throw new WaldError(`Unclosed tag '<${tag}>': expected '>' or '/>'`, line, column)
    }

    if (this.current === '/' && this.peek(1) === '>') {
      this.advance() // /
      this.advance() // >
      if (/^[A-Z]/.test(tag)) {
        return { type: 'component', name: tag, attrs, children: [], canopy }
      }
      return { type: 'element', tag, attrs, children: [] }
    }

    if (this.current === '>') this.advance()

    // Void elements don't have closing tags (but components with void names are not treated as void)
    if (!/^[A-Z]/.test(tag) && VOID_ELEMENTS.has(tag.toLowerCase())) {
      return { type: 'element', tag, attrs, children: [] }
    }

    const children = this.scanNodes()

    if (this.current === '<' && this.peek(1) === '/') {
      this.advance() // <
      this.advance() // /
      while (this.pos < this.source.length && (this.current as string) !== '>') this.advance()
      this.advance() // >
    }

    if (/^[A-Z]/.test(tag)) {
      return { type: 'component', name: tag, attrs, children, canopy }
    }
    return { type: 'element', tag, attrs, children }
  }

  private extractCanopy(tag: string, attrs: AttributeNode[], openPos: number): ComponentNode['canopy'] {
    let canopy: ComponentNode['canopy']

    for (let index = attrs.length - 1; index >= 0; index--) {
      const attr = attrs[index]
      if (!attr.name.startsWith('canopy:')) continue
      const strategy = attr.name.slice('canopy:'.length)

      if (strategy !== 'load' && strategy !== 'idle' && strategy !== 'visible') {
        const { line, column } = offsetToLineCol(this.source, openPos)
        throw new WaldError(
          `${attr.name} is not valid on <${tag}> — use canopy:load, canopy:idle or canopy:visible`,
          line,
          column,
        )
      }

      canopy = { strategy }
      attrs.splice(index, 1)
    }

    return canopy
  }

  private scanIdentifier(allowColon = false): string {
    let id = ''
    const pattern = allowColon ? /[\w:-]/ : /[\w-]/
    while (this.pos < this.source.length && pattern.test(this.current)) {
      id += this.advance()
    }
    return id
  }

  private scanAttributes(): AttributeNode[] {
    const attrs: AttributeNode[] = []
    while (
      this.pos < this.source.length &&
      this.current !== '>' &&
      !(this.current === '/' && this.peek(1) === '>')
    ) {
      this.skipWhitespace()
      if (this.current === '>' || (this.current === '/' && this.peek(1) === '>')) break
      const attr = this.scanAttribute()
      if (attr) attrs.push(attr)
    }
    return attrs
  }

  private scanAttribute(): AttributeNode | null {
    const name = this.scanIdentifier(true)
    if (!name) {
      this.advance()
      return null
    }

    if (this.current !== '=') {
      return { type: 'attribute', name, value: '' }
    }

    this.advance() // consume =

    if ((this.current as string) === '"') {
      const quotePos = this.pos
      this.advance() // consume opening "
      let value = ''
      while (this.pos < this.source.length && (this.current as string) !== '"') {
        value += this.advance()
      }
      if (this.pos >= this.source.length) {
        const { line, column } = offsetToLineCol(this.source, quotePos)
        throw new WaldError(`Unclosed string attribute: expected '"'`, line, column)
      }
      this.advance() // consume closing "
      return { type: 'attribute', name, value }
    }

    if ((this.current as string) === '{') {
      const expr = this.scanExpression()
      return { type: 'attribute', name, value: expr as import('../ast/types.js').ExpressionNode }
    }

    return { type: 'attribute', name, value: '' }
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.current)) {
      this.advance()
    }
  }
}
