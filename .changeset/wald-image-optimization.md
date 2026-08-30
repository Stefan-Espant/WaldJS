---
"@waldjs/cli": minor
---

Add `wald:image`'s `<Image src="..." alt="..." widths={[400, 800]} />` for responsive, optimized images. `wald build` resizes the source to each requested width, converts it to WebP, and writes the variants to `dist/assets/optimized/`, producing a matching `srcset`/`sizes` and the source's natural `width`/`height`. Formats WebP can't usefully re-encode (SVG, GIF) pass through unprocessed. `wald grow` skips processing and serves the original file directly. Adds `sharp` as a new dependency of `@waldjs/cli`.
