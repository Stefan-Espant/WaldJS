import type { TemplateNode, ElementNode, ComponentNode, AttributeNode, ScriptNode } from '../ast/types.js'
import { WaldError, offsetToLineCol } from '../errors.js'

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
    this.advance() // consume <
    const tag = this.scanIdentifier()
    const attrs = this.scanAttributes()

    if (this.current === '/' && this.peek(1) === '>') {
      this.advance() // /
      this.advance() // >
      if (/^[A-Z]/.test(tag)) {
        return { type: 'component', name: tag, attrs, children: [] }
      }
      return { type: 'element', tag, attrs, children: [] }
    }

    if (this.current === '>') this.advance()

    const children = this.scanNodes()

    if (this.current === '<' && this.peek(1) === '/') {
      this.advance() // <
      this.advance() // /
      while (this.pos < this.source.length && (this.current as string) !== '>') this.advance()
      this.advance() // >
    }

    if (/^[A-Z]/.test(tag)) {
      return { type: 'component', name: tag, attrs, children }
    }
    return { type: 'element', tag, attrs, children }
  }

  private scanIdentifier(): string {
    let id = ''
    while (this.pos < this.source.length && /[\w-]/.test(this.current)) {
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
    const name = this.scanIdentifier()
    if (!name) {
      this.advance()
      return null
    }

    if (this.current !== '=') {
      return { type: 'attribute', name, value: '' }
    }

    this.advance() // consume =

    if ((this.current as string) === '"') {
      this.advance() // consume opening "
      let value = ''
      while (this.pos < this.source.length && (this.current as string) !== '"') {
        value += this.advance()
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
