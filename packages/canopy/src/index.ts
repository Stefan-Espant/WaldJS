class WaldCanopy extends HTMLElement {
  async connectedCallback() {
    const src = this.dataset.src
    const strategy = this.dataset.strategy as 'load' | 'idle' | 'visible' | undefined

    if (!src || !strategy) return

    const props = JSON.parse(this.dataset.props ?? '{}')

    const run = async () => {
      try {
        const mod = await import(/* @vite-ignore */ src)
        if (typeof mod.default !== 'function') {
          console.error(`[wald-canopy] ${src} does not export a default function`)
          return
        }
        mod.default(this, props)
      } catch (error) {
        console.error(`[wald-canopy] Failed to load ${src}:`, error)
      }
    }

    if (strategy === 'load') {
      void run()
      return
    }

    if (strategy === 'idle') {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          void run()
        })
      } else {
        setTimeout(() => {
          void run()
        }, 1)
      }
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        observer.disconnect()
        void run()
      }
    })
    observer.observe(this)
  }
}

if (!customElements.get('wald-canopy')) {
  customElements.define('wald-canopy', WaldCanopy)
}
