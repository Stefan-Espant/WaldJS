---
"@waldjs/cli": minor
---

Add `githubPagesAdapter()` (writes `.nojekyll` and a `404.html` fallback) and `denoDeployAdapter()` (Deno Deploy needs no special static-output shape, so this is a named alias documenting the deploy target) alongside the existing `staticAdapter`/`netlifyAdapter`/`cloudflarePagesAdapter`/`vercelAdapter`.
