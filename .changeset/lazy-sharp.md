---
"@waldjs/cli": patch
---

sharp is now loaded only when an image is actually optimized. It used to load whenever `@waldjs/cli` was imported, which every `wald.config.ts` does for `defineConfig`.
