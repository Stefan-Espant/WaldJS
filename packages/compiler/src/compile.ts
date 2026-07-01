import { parse } from './parser/index.js'
import { transform } from './transform/index.js'
import { WaldError } from './errors.js'

export function compile(source: string, id: string): string {
  try {
    const ast = parse(source)
    return transform(ast)
  } catch (e) {
    if (e instanceof WaldError) {
      e.file = id
    }
    throw e
  }
}
