---
"@waldjs/cli": minor
---

**`wald build` now adds a generator meta tag to your pages.** Every built page that doesn't already declare a `<meta name="generator">` gets `<meta name="generator" content="WaldJS v<version>">`, so sites built with WaldJS can be recognised. A generator tag in your own layout always takes precedence. Don't want it? Opt out in `wald.config.ts`:

```ts
export default defineConfig({ generator: false })
```
