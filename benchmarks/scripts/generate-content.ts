import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const contentDir = join(__dirname, '../content/blog')
mkdirSync(contentDir, { recursive: true })

const para = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
].join(' ')

for (let i = 1; i <= 50; i++) {
  const n = String(i).padStart(3, '0')
  const date = `2026-${String(Math.ceil(i / 31)).padStart(2, '0')}-${String(((i - 1) % 28) + 1).padStart(2, '0')}`
  writeFileSync(
    join(contentDir, `post-${n}.md`),
    `---\ntitle: "Benchmark Post ${n}"\ndate: ${date}\nauthor: Benchmark\n---\n\n${para}\n\n${para}\n\n${para}\n`,
  )
}

console.log(`Generated 50 posts in ${contentDir}`)
