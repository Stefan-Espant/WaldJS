#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'

const require = createRequire(import.meta.url)

const args = process.argv.slice(2)

async function resolveName() {
  const positional = args.find(a => !a.startsWith('-'))
  if (positional) return positional

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question('Project name: (my-forest) ')
  rl.close()
  return answer.trim() || 'my-forest'
}

const name = await resolveName()

// Resolve @waldjs/cli via Node's own module resolution instead of assuming a
// specific node_modules layout — npm hoists dependencies flat, pnpm keeps
// them isolated per-package, and a hardcoded relative path breaks on one of
// the two depending on which package manager installed us.
const cliEntry = require.resolve('@waldjs/cli')
const waldBin = join(dirname(dirname(cliEntry)), 'bin', 'wald.js')

execFileSync(process.execPath, [waldBin, 'plant', name], { stdio: 'inherit' })
