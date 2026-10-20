---
"@waldjs/cli": minor
---

**Faster `wald build`.** When a project needs nothing Vite-specific (no `vite` options other than `ssr.external`, no `import.meta.env` / `import.meta.glob` / `?raw` / `?url` in `src/`), the SSR pages and canopy islands are bundled with esbuild directly and Vite is not loaded at all; `wald.config.ts` is loaded with esbuild too. Output is the same (verified byte-for-byte on the WaldJS site, apart from canopy asset hashes). Anything else, or any esbuild failure, uses the Vite pipeline as before; force it with `WALD_SSR_BUNDLER=vite`. On a 50-post blog a build goes from ~0.80 s to ~0.53 s.
