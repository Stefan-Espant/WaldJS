export type FrontmatterResult = {
  code: string
  rest: string
}

const DELIMITER = '---'

export function extractFrontmatter(source: string): FrontmatterResult {
  const trimmed = source.trimStart()

  if (!trimmed.startsWith(DELIMITER)) {
    return { code: '', rest: source }
  }

  const afterFirst = trimmed.slice(DELIMITER.length)
  const end = afterFirst.indexOf('\n' + DELIMITER)

  if (end === -1) {
    throw new Error('Unclosed frontmatter block — missing closing ---')
  }

  const code = afterFirst.slice(0, end).trim()
  const rest = afterFirst.slice(end + DELIMITER.length + 1).trimStart()

  return { code, rest }
}
