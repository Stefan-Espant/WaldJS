import { parse } from './parser/index.js'
import { transformWithMap, type TransformResult } from './transform/index.js'
import { WaldError } from './errors.js'

export function compile(source: string, id: string): string {
  return compileWithMap(source, id).code
}

export function compileWithMap(source: string, id: string): TransformResult {
  try {
    const ast = parse(source)
    return transformWithMap(ast)
  } catch (e) {
    if (e instanceof WaldError) {
      e.file = id
    }
    throw e
  }
}
