// Mirrors the `NO_HOIST_ATTR` pattern in shell.ts and the `wald:prefetch`
// detection in prefetch-runtime.ts: rather than tracking which pages use
// which components, just check the rendered HTML for the marker a styled
// component's own scoping already leaves behind.
const SCOPE_ATTR_PATTERN = /\sdata-wald-[0-9a-f]{8}(?=[\s=/>])/

export function needsComponentStyles(html: string): boolean {
  return SCOPE_ATTR_PATTERN.test(html)
}

export function injectComponentStyles(html: string): string {
  if (!needsComponentStyles(html)) return html
  const link = `<link rel="stylesheet" href="/assets/wald-components.css">`
  return html.includes('</head>') ? html.replace('</head>', `${link}\n</head>`) : html + link
}
