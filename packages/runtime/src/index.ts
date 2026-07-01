type RenderFn<TProps extends Record<string, unknown> = Record<string, unknown>> = (
  $$result: BuildContext,
  $$props: TProps
) => Promise<string>

type BuildContext = Record<string, never>

export type Tree<TProps extends Record<string, unknown> = Record<string, unknown>> = {
  render: (props?: TProps) => Promise<string>
}

export function createTree<TProps extends Record<string, unknown> = Record<string, unknown>>(
  fn: RenderFn<TProps>
): Tree<TProps> {
  return {
    render: (props = {} as TProps) => fn({}, props),
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
