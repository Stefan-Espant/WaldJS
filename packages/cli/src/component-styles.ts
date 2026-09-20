import { joinUrl } from './canopy-build.js'

// Mirrors the `NO_HOIST_ATTR` pattern in shell.ts and the `wald:prefetch`
// detection in prefetch-runtime.ts: rather than tracking which pages use
// which components, just check the rendered HTML for the marker a styled
// component's own scoping already leaves behind.
const SCOPE_ATTR_PATTERN = /\sdata-wald-[0-9a-f]{8}(?=[\s=/>])/

export function needsComponentStyles(html: string): boolean {
  return SCOPE_ATTR_PATTERN.test(html)
}

// The one place the component-styles bundle's URL is computed — used both
// to build the injected <link> below and by wald grow's dev-server route
// for that same bundle (see grow.ts), so the two can never drift out of
// sync with each other or with config.base the way they used to.
export function componentStylesHref(base: string): string {
  return joinUrl(base, 'assets/wald-components.css')
}

export function injectComponentStyles(html: string, base = '/'): string {
  if (!needsComponentStyles(html)) return html
  const link = `<link rel="stylesheet" href="${componentStylesHref(base)}">`
  return html.includes('</head>') ? html.replace('</head>', `${link}\n</head>`) : html + link
}
