import { createRequire } from 'node:module'

// Read from package.json so `wald --version` and Wald.generator never drift
// from the published version. ../package.json resolves from both src/ and dist/.
const pkg = createRequire(import.meta.url)('../package.json') as { version: string }

export const WALD_VERSION = pkg.version
/** Value of `Wald.generator` in every compiled .wald module, e.g. for <meta name="generator">. */
export const WALD_GENERATOR = `WaldJS v${WALD_VERSION}`
