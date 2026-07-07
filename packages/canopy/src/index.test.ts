// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import './index.js'

describe('wald-canopy custom element', () => {
  it('registers the custom element on import', () => {
    expect(customElements.get('wald-canopy')).toBeDefined()
  })

  it('canopy:load strategy invokes the factory immediately with deserialized props', async () => {
    const code = `export default function(root, props) { root.setAttribute('data-called', JSON.stringify(props)) }`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'load'
    el.dataset.props = JSON.stringify({ count: 5 })
    document.body.appendChild(el)

    await vi.waitFor(() => expect(el.getAttribute('data-called')).not.toBeNull())
    expect(el.getAttribute('data-called')).toBe(JSON.stringify({ count: 5 }))
  })

  it('defaults props to an empty object when data-props is absent', async () => {
    const code = `export default function(root, props) { root.setAttribute('data-props-received', JSON.stringify(props)) }`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'load'
    document.body.appendChild(el)

    await vi.waitFor(() => expect(el.getAttribute('data-props-received')).toBe('{}'))
  })

  it('canopy:idle strategy invokes the factory asynchronously, not synchronously', async () => {
    const code = `export default function(root) { root.setAttribute('data-called', 'true') }`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'idle'
    document.body.appendChild(el)

    expect(el.getAttribute('data-called')).toBeNull()
    await vi.waitFor(() => expect(el.getAttribute('data-called')).toBe('true'))
  })

  it('canopy:visible strategy invokes the factory once the element intersects the viewport', async () => {
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

    const code = `export default function(root) { root.setAttribute('data-called', 'true') }`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'visible'
    document.body.appendChild(el)

    expect(el.getAttribute('data-called')).toBeNull()
    observedCallback([{ isIntersecting: true }])
    await vi.waitFor(() => expect(el.getAttribute('data-called')).toBe('true'))
    expect(disconnect).toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('logs a console.error and does not throw when the module has no default function export', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const code = `export const notDefault = 1`
    const src = `data:text/javascript,${encodeURIComponent(code)}`
    const el = document.createElement('wald-canopy')
    el.dataset.src = src
    el.dataset.strategy = 'load'
    document.body.appendChild(el)

    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled())
    expect(String(errorSpy.mock.calls[0][0])).toContain('does not export a default function')

    errorSpy.mockRestore()
  })
})
