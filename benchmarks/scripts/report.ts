import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resultsFile = join(__dirname, '../results/latest.json')

interface LighthouseScores {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
}

interface FrameworkResult {
  buildMs: number | 'BUILD_FAILED'
  lighthouse: LighthouseScores | 'LIGHTHOUSE_FAILED'
}

const data: { timestamp: string; results: Record<string, FrameworkResult> } = JSON.parse(
  readFileSync(resultsFile, 'utf-8'),
)

function pad(s: string, n: number): string {
  return s.padEnd(n)
}

function fmtBuild(ms: number | 'BUILD_FAILED'): string {
  if (ms === 'BUILD_FAILED') return pad('FAILED', 13)
  return pad(`${(ms / 1000).toFixed(2)}s`, 13)
}

function fmtScore(score: number | undefined): string {
  return pad(String(score ?? 'N/A'), 6)
}

console.log('\nWaldJS Benchmark Results')
console.log(`Run: ${data.timestamp}\n`)
console.log(
  pad('Framework', 12) + pad('Build (med)', 13) + pad('Perf', 6) + pad('A11y', 6) + pad('Best', 6) + 'SEO',
)
console.log('─'.repeat(49))

for (const [fw, result] of Object.entries(data.results)) {
  const lh = result.lighthouse === 'LIGHTHOUSE_FAILED' ? null : result.lighthouse
  console.log(
    pad(fw.charAt(0).toUpperCase() + fw.slice(1), 12) +
      fmtBuild(result.buildMs) +
      (lh ? fmtScore(lh.performance) : pad('N/A', 6)) +
      (lh ? fmtScore(lh.accessibility) : pad('N/A', 6)) +
      (lh ? fmtScore(lh.bestPractices) : pad('N/A', 6)) +
      (lh ? lh.seo : 'N/A'),
  )
}
console.log()
