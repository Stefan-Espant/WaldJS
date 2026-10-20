import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const contentDir = join(__dirname, '../content/blog')
// BENCH_POSTS sets the site size (default 50). The directory is emptied first
// so a smaller run never inherits posts from a larger one.
const POSTS = Number(process.env.BENCH_POSTS ?? 50)
rmSync(contentDir, { recursive: true, force: true })
mkdirSync(contentDir, { recursive: true })

const para = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
].join(' ')

for (let i = 1; i <= POSTS; i++) {
  const n = String(i).padStart(3, '0')
  // One post per day counting back from 2026-06-30: always a valid date, at any size.
  const date = new Date(Date.UTC(2026, 5, 30) - (i - 1) * 86_400_000).toISOString().slice(0, 10)
  writeFileSync(
    join(contentDir, `post-${n}.md`),
    `---\ntitle: "Benchmark Post ${n}"\ndate: ${date}\nauthor: Benchmark\n---\n\n${para}\n\n${para}\n\n${para}\n`,
  )
}

console.log(`Generated ${POSTS} posts in ${contentDir}`)
