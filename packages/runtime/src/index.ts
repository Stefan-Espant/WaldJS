type RenderFn = (
  $$result: BuildContext,
  $$props: Record<string, unknown>
) => Promise<string>

type BuildContext = Record<string, never>

export type Tree = {
  render: (props?: Record<string, unknown>) => Promise<string>
}

export function createTree(fn: RenderFn): Tree {
  return {
    render: (props = {}) => fn({}, props),
  }
}

export class SafeHtml {
  constructor(public readonly value: string) {}
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
    const value = values[i]
    result += (value instanceof SafeHtml ? value.value : escapeHtml(value)) + strings[i + 1]
  }
  return result
}
