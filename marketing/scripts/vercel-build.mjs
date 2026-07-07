import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const marketingDir = dirname(dirname(fileURLToPath(import.meta.url)))
const root = dirname(marketingDir)
const node = process.execPath

const tscCandidates = [
  join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
  join(marketingDir, 'node_modules', 'typescript', 'bin', 'tsc'),
]
const tsc = tscCandidates.find(existsSync)

if (!tsc) {
  throw new Error(`Could not find TypeScript. Tried: ${tscCandidates.join(', ')}`)
}

console.log(`[vercel-build] root=${root}`)

for (const project of ['compiler', 'runtime', 'content', 'canopy', 'cli']) {
  execFileSync(node, [tsc, '-p', join(root, 'packages', project, 'tsconfig.json')], {
    cwd: root,
    stdio: 'inherit',
  })
}

execFileSync(node, [join(root, 'packages', 'cli', 'bin', 'wald.js'), 'build'], {
  cwd: marketingDir,
  stdio: 'inherit',
})
