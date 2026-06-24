import { parse } from './parser/index.js'
import { transform } from './transform/index.js'

export function compile(source: string, _id: string): string {
  const ast = parse(source)
  return transform(ast)
}
