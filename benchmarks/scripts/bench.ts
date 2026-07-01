import { execSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import sirv from 'sirv'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

type Framework = 'wald' | 'astro' | 'eleventy'

const FRAMEWORKS: Framework[] = ['wald', 'astro', 'eleventy']

const CONTENT_DEST: Record<Framework, string> = {
  wald: 'content/blog',
  astro: 'src/content/blog',
  eleventy: 'src/blog',
}

// Per-framework pages — WaldJS uses no trailing slash (flat .html files)
// Astro and Eleventy use trailing slash (directory index.html)
const PAGES: Record<Framework, string[]> = {
  wald:     ['/', '/blog/', '/blog/post-001', '/blog/post-025', '/blog/post-050'],
  astro:    ['/', '/blog/', '/blog/post-001/', '/blog/post-025/', '/blog/post-050/'],
  eleventy: ['/', '/blog/', '/blog/post-001/', '/blog/post-025/', '/blog/post-050/'],
}

const PORT = 4321
const BUILD_RUNS = 3

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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function syncContent(fw: Framework): void {
  const src = join(root, 'content/blog')
  const dest = join(root, fw, CONTENT_DEST[fw])
  mkdirSync(dest, { recursive: true })
  for (const file of readdirSync(src)) {
    copyFileSync(join(src, file), join(dest, file))
  }
}

function ensureInstalled(fw: Framework): void {
  const nodeModules = join(root, fw, 'node_modules')
  if (!existsSync(nodeModules)) {
    console.log(`  [${fw}] Installing dependencies...`)
    execSync('pnpm install --ignore-workspace', { cwd: join(root, fw), stdio: 'pipe' })
  }
}

function timeBuild(fw: Framework): number | 'BUILD_FAILED' {
  const times: number[] = []
  for (let i = 0; i < BUILD_RUNS; i++) {
    try {
      rmSync(join(root, fw, 'dist'), { recursive: true, force: true })
      const start = performance.now()
      execSync('pnpm build', { cwd: join(root, fw), stdio: 'pipe' })
      times.push(performance.now() - start)
      console.log(`  [${fw}] Run ${i + 1}/${BUILD_RUNS}: ${Math.round(times[i])}ms`)
    } catch (err) {
      console.error(`  [${fw}] Build run ${i + 1} failed:`, (err as Error).message.slice(0, 200))
      return 'BUILD_FAILED'
    }
  }
  return Math.round(median(times))
}

function startServer(distDir: string): Promise<ReturnType<typeof createServer>> {
  return new Promise((resolve) => {
    const handler = sirv(distDir, { extensions: ['html'] })
    const server = createServer(handler)
    server.listen(PORT, () => resolve(server))
  })
}

async function runLighthouse(fw: Framework): Promise<LighthouseScores | 'LIGHTHOUSE_FAILED'> {
  const distDir = join(root, fw, 'dist')
  const server = await startServer(distDir)
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
  })

  const scores: Record<string, number[]> = {
    performance: [],
    accessibility: [],
    bestPractices: [],
    seo: [],
  }

  for (const page of PAGES[fw]) {
    try {
      const result = await lighthouse(`http://localhost:${PORT}${page}`, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      })
      if (!result) continue
      const cats = result.lhr.categories
      scores.performance.push((cats['performance']?.score ?? 0) * 100)
      scores.accessibility.push((cats['accessibility']?.score ?? 0) * 100)
      scores.bestPractices.push((cats['best-practices']?.score ?? 0) * 100)
      scores.seo.push((cats['seo']?.score ?? 0) * 100)
    } catch {
      console.error(`  [${fw}] Lighthouse failed for ${page}`)
    }
  }

  await chrome.kill()
  await new Promise<void>((resolve) => server.close(() => resolve()))

  if (scores.performance.length === 0) return 'LIGHTHOUSE_FAILED'

  return {
    performance: Math.round(avg(scores.performance)),
    accessibility: Math.round(avg(scores.accessibility)),
    bestPractices: Math.round(avg(scores.bestPractices)),
    seo: Math.round(avg(scores.seo)),
  }
}

async function main(): Promise<void> {
  console.log('WaldJS Benchmark Suite\n')

  if (!existsSync(join(root, 'content/blog'))) {
    console.error('Run `pnpm generate` first to create shared content.')
    process.exit(1)
  }

  const results: Record<string, FrameworkResult> = {}

  for (const fw of FRAMEWORKS) {
    console.log(`\n[${fw}]`)
    syncContent(fw)
    ensureInstalled(fw)

    const buildMs = timeBuild(fw)
    console.log(`  Build median: ${buildMs === 'BUILD_FAILED' ? 'FAILED' : `${buildMs}ms`}`)

    let lighthouseResult: LighthouseScores | 'LIGHTHOUSE_FAILED' = 'LIGHTHOUSE_FAILED'
    if (buildMs !== 'BUILD_FAILED') {
      console.log(`  Lighthouse on ${PAGES[fw].length} pages...`)
      lighthouseResult = await runLighthouse(fw)
      if (lighthouseResult !== 'LIGHTHOUSE_FAILED') {
        console.log(
          `  Perf: ${lighthouseResult.performance}  A11y: ${lighthouseResult.accessibility}  Best: ${lighthouseResult.bestPractices}  SEO: ${lighthouseResult.seo}`,
        )
      }
    }

    results[fw] = { buildMs, lighthouse: lighthouseResult }
  }

  mkdirSync(join(root, 'results'), { recursive: true })
  const output = { timestamp: new Date().toISOString(), results }
  writeFileSync(join(root, 'results/latest.json'), JSON.stringify(output, null, 2))
  console.log('\nResults saved to results/latest.json')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
