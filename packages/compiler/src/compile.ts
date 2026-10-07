import { parse } from './parser/index.js'
import { transformWithMap, type TransformOptions, type TransformResult } from './transform/index.js'
import { WaldError } from './errors.js'

export function compile(source: string, id: string, options: TransformOptions = {}): string {
  return compileWithMap(source, id, options).code
}

export function compileWithMap(source: string, id: string, options: TransformOptions = {}): TransformResult {
  try {
    const ast = parse(source)
    return transformWithMap(ast, id, options)
  } catch (e) {
    if (e instanceof WaldError) {
      e.file = id
    }
    throw e
  }
}
