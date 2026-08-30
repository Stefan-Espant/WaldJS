// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { installPrefetch, prefetchRuntimeScript } from './prefetch.js'

describe('installPrefetch', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.head.querySelectorAll('link[rel="prefetch"]').forEach((l) => l.remove())
  })

  it('prefetches on mouseenter for wald:prefetch="hover"', () => {
    document.body.innerHTML = '<a href="/about" wald:prefetch="hover">About</a>'
    installPrefetch()
    document.querySelector('a')!.dispatchEvent(new MouseEvent('mouseenter'))

    const link = document.head.querySelector('link[rel="prefetch"]')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('/about')
  })

  it('does not prefetch before mouseenter fires', () => {
    document.body.innerHTML = '<a href="/about" wald:prefetch="hover">About</a>'
    installPrefetch()
    expect(document.head.querySelector('link[rel="prefetch"]')).toBeNull()
  })

  it('dedupes repeated mouseenter events for the same href', () => {
    document.body.innerHTML = '<a href="/about" wald:prefetch="hover">About</a>'
    installPrefetch()
    const a = document.querySelector('a')!
    a.dispatchEvent(new MouseEvent('mouseenter'))
    a.dispatchEvent(new MouseEvent('mouseenter'))
    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(1)
  })

  it('prefetches once an element intersects for wald:prefetch="visible"', () => {
    let observedCallback: (entries: { isIntersecting: boolean }[]) => void = () => {}
    const disconnect = vi.fn()
    class FakeIntersectionObserver {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        observedCallback = cb
      }
      observe() {}
      disconnect = disconnect
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)

    document.body.innerHTML = '<a href="/about" wald:prefetch="visible">About</a>'
    installPrefetch()
    observedCallback([{ isIntersecting: true }])

    const link = document.head.querySelector('link[rel="prefetch"]')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('/about')
    expect(disconnect).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('does not prefetch on an intersection observer entry that is not intersecting', () => {
    let observedCallback: (entries: { isIntersecting: boolean }[]) => void = () => {}
    class FakeIntersectionObserver {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        observedCallback = cb
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)

    document.body.innerHTML = '<a href="/about" wald:prefetch="visible">About</a>'
    installPrefetch()
    observedCallback([{ isIntersecting: false }])

    expect(document.head.querySelector('link[rel="prefetch"]')).toBeNull()
    vi.unstubAllGlobals()
  })

  it('ignores elements with an unrecognized wald:prefetch value', () => {
    document.body.innerHTML = '<a href="/about" wald:prefetch="bogus">About</a>'
    installPrefetch()
    document.querySelector('a')!.dispatchEvent(new MouseEvent('mouseenter'))
    expect(document.head.querySelector('link[rel="prefetch"]')).toBeNull()
  })

  it('does not throw for an element with an empty href', () => {
    document.body.innerHTML = '<a href="" wald:prefetch="hover">No link</a>'
    expect(() => installPrefetch()).not.toThrow()
  })

  it('ignores elements with no wald:prefetch attribute at all', () => {
    document.body.innerHTML = '<a href="/about">Plain link</a>'
    installPrefetch()
    document.querySelector('a')!.dispatchEvent(new MouseEvent('mouseenter'))
    expect(document.head.querySelector('link[rel="prefetch"]')).toBeNull()
  })
})

describe('prefetchRuntimeScript', () => {
  it('produces a self-invoking script string containing the prefetch logic', () => {
    const script = prefetchRuntimeScript()
    expect(script).toContain('wald:prefetch')
    expect(script.trim().startsWith('(')).toBe(true)
    expect(script.trim().endsWith(')();')).toBe(true)
  })
})
