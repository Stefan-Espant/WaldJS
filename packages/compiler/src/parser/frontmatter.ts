export type FrontmatterResult = {
  code: string
  rest: string
  line: number
}

const DELIMITER = '---'

export function extractFrontmatter(source: string): FrontmatterResult {
  const trimmed = source.trimStart()

  if (!trimmed.startsWith(DELIMITER)) {
    return { code: '', rest: source, line: 1 }
  }

  const leadingNewlines = (source.slice(0, source.length - trimmed.length).match(/\n/g) ?? []).length

  const afterFirst = trimmed.slice(DELIMITER.length)
  const end = afterFirst.indexOf('\n' + DELIMITER)

  if (end === -1) {
    const line = (afterFirst.match(/\n/g) ?? []).length + 1
    const err = Object.assign(
      new Error('Unclosed frontmatter block — missing closing ---'),
      { line }
    )
    throw err
  }

  const rawCode = afterFirst.slice(0, end)
  const codeLeadingNewlines = (rawCode.slice(0, rawCode.length - rawCode.trimStart().length).match(/\n/g) ?? []).length
  const line = leadingNewlines + 1 + codeLeadingNewlines

  const code = rawCode.trim()
  const rest = afterFirst.slice(end + DELIMITER.length + 1).trimStart()

  return { code, rest, line }
}
