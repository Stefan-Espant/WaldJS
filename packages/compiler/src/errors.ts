export class WaldError extends Error {
  readonly line: number
  readonly column: number
  file?: string

  constructor(message: string, line: number, column: number) {
    super(message)
    this.name = 'WaldError'
    this.line = line
    this.column = column
  }
}

export function offsetToLineCol(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset)
  const lines = before.split('\n')
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  }
}
