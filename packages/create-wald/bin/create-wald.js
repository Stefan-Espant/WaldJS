#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'

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
const waldBin = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.bin', 'wald')

execFileSync(waldBin, ['plant', name], { stdio: 'inherit' })
