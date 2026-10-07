---
"@waldjs/compiler": minor
"@waldjs/cli": minor
---

Add `Wald.generator`: every compiled `.wald` module now has a built-in `Wald` object whose `generator` is `"WaldJS v<cli version>"`, and the `wald plant` starter layout emits `<meta name="generator" content={Wald.generator} />`. `wald --version` now reports the real CLI version instead of a hardcoded `0.1.0`.
