import { prefetchRuntimeScript } from '@waldjs/canopy/prefetch'

const PREFETCH_ATTR_PATTERN = /\swald:prefetch\s*=/

// Detecting per-rendered-page (rather than pre-scanning source files, the
// way Canopy islands are scanned) keeps this independent of the canopy
// asset-bundling pipeline entirely — the runtime is a small inline <script>,
// not a separate bundled asset, so there's nothing to resolve at dev time.
export function needsPrefetchRuntime(html: string): boolean {
  return PREFETCH_ATTR_PATTERN.test(html)
}

export function injectPrefetchRuntime(html: string): string {
  if (!needsPrefetchRuntime(html)) return html
  const script = `<script>${prefetchRuntimeScript()}</script>`
  return html.includes('</body>') ? html.replace('</body>', `${script}\n</body>`) : html + script
}
