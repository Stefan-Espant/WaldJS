import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const node = process.execPath
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')

for (const project of ['compiler', 'runtime', 'content', 'canopy', 'cli']) {
  execFileSync(node, [tsc, '-p', join(root, 'packages', project, 'tsconfig.json')], {
    cwd: root,
    stdio: 'inherit',
  })
}

execFileSync(node, [join(root, 'packages', 'cli', 'bin', 'wald.js'), 'build'], {
  cwd: join(root, 'marketing'),
  stdio: 'inherit',
})
