// wald build adds <meta name="generator"> to every page that doesn't already
// declare one, so sites built with WaldJS can be recognised — including
// projects whose Layout.wald predates the starter's own tag. A tag the page
// already has (any generator, any attribute order) always wins.
// Opt out with `generator: false` in wald.config.ts.
const GENERATOR_META = /<meta\b[^>]*\bname\s*=\s*(["']?)generator\1(?=[\s/>])/i
const HEAD_OPEN = /<head(?:\s[^>]*)?>/i

export function hasGeneratorMeta(html: string): boolean {
  return GENERATOR_META.test(html)
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function injectGeneratorMeta(html: string, generator: string): string {
  if (hasGeneratorMeta(html)) return html
  const head = HEAD_OPEN.exec(html)
  if (!head) return html
  const at = head.index + head[0].length
  return `${html.slice(0, at)}\n<meta name="generator" content="${escapeAttr(generator)}">${html.slice(at)}`
}
