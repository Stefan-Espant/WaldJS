type RenderFn = (
  $$result: BuildContext,
  $$props: Record<string, unknown>
) => Promise<string>

type BuildContext = Record<string, never>

export type Tree = {
  render: () => Promise<string>
}

export function createTree(fn: RenderFn): Tree {
  return {
    render: () => fn({}, {}),
  }
}

const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/[&<>"']/g, (char) => escapeMap[char])
}

export function renderTemplate(
  strings: TemplateStringsArray,
  ...values: unknown[]
): string {
  let result = strings[0]
  for (let i = 0; i < values.length; i++) {
    result += escapeHtml(values[i]) + strings[i + 1]
  }
  return result
}
