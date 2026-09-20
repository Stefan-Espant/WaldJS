// Powers wald:prefetch="hover" / wald:prefetch="visible" on any element with
// an href. Unlike canopy islands, this needs no compiler support — the
// attribute is plain unrecognized HTML on a lowercase tag, so it passes
// through the compiler untouched (same mechanism as data-wald-no-hoist).
// installPrefetch() itself is serialized via .toString() (see
// prefetchRuntimeScript()) and inlined as a raw <script> only on pages that
// actually use the directive — see packages/cli/src/prefetch-runtime.ts.
export function installPrefetch(): void {
  const seen = new Set<string>()

  function prefetch(href: string): void {
    if (!href || seen.has(href)) return
    seen.add(href)
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = href
    document.head.appendChild(link)
  }

  // Filtered in JS rather than via a `[wald\:prefetch]` CSS attribute
  // selector — colon-escaping in attribute selectors is inconsistent across
  // DOM implementations (confirmed failing in happy-dom during testing).
  document.querySelectorAll<HTMLElement>('[href]').forEach((el) => {
    const strategy = el.getAttribute('wald:prefetch')
    const href = el.getAttribute('href')
    if (!strategy || !href) return

    if (strategy === 'hover') {
      el.addEventListener('mouseenter', () => prefetch(href), { once: true })
    } else if (strategy === 'visible' && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            prefetch(href)
            observer.disconnect()
            break
          }
        }
      })
      observer.observe(el)
    }
  })
}

export function prefetchRuntimeScript(): string {
  return `(${installPrefetch.toString()})();`
}
