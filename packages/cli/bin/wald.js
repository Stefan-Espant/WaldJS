#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)))
const srcDir = join(packageDir, 'src')
const distEntry = join(packageDir, 'dist', 'cli.js')
const tscBin = join(packageDir, 'node_modules', 'typescript', 'bin', 'tsc')

function newestMtime(dir) {
  let newest = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtime(path))
    } else if (entry.name.endsWith('.ts')) {
      newest = Math.max(newest, statSync(path).mtimeMs)
    }
  }
  return newest
}

function distIsStale() {
  if (!existsSync(distEntry)) return true
  return newestMtime(srcDir) > statSync(distEntry).mtimeMs
}

if (distIsStale()) {
  execFileSync(process.execPath, [tscBin, '-p', packageDir], { stdio: 'inherit' })
}

import('../dist/cli.js')
