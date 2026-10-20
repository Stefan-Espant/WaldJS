import { execSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import os from 'node:os'
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

// Warm-up builds are run but not counted: the first build after an install can
// be dominated by one-off costs (Astro 4's cold WASM start once took ~139s per
// run on a 50-post site while warm builds took ~5s), which a 3-run median let
// through. 7 measured runs keep a single outlier from setting the median.
const WARMUP_RUNS = 2
const BUILD_RUNS = 7

interface LighthouseScores {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
}

interface FrameworkResult {
  buildMs: number | 'BUILD_FAILED'
  build?: { runsMs: number[]; minMs: number; maxMs: number; warmupRuns: number }
  version?: string
  jsBytes?: number
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
  // Remove only generated posts: leftovers from a run with a different
  // BENCH_POSTS would skew it, but the folder also holds config (Eleventy's
  // blog.11tydata.json assigns the post layout) that must survive.
  for (const file of readdirSync(dest)) {
    if (/^post-\d+\.md$/.test(file)) rmSync(join(dest, file))
  }
  for (const file of readdirSync(src)) {
    copyFileSync(join(src, file), join(dest, file))
  }
}

function ensureInstalled(fw: Framework): void {
  // The WaldJS site is a workspace member (it benchmarks this repo's own
  // packages), so the root `pnpm install` already installed it.
  if (fw === 'wald') return
  const nodeModules = join(root, fw, 'node_modules')
  if (!existsSync(nodeModules)) {
    console.log(`  [${fw}] Installing dependencies...`)
    // Each comparison site has its own pnpm-workspace.yaml (its own root, with
    // its build-script approvals), so a plain install stays out of the monorepo.
    execSync('pnpm install', { cwd: join(root, fw), stdio: 'pipe' })
  }
}

function timeBuild(fw: Framework): NonNullable<FrameworkResult['build']> | 'BUILD_FAILED' {
  const times: number[] = []
  for (let i = 0; i < WARMUP_RUNS + BUILD_RUNS; i++) {
    const warmup = i < WARMUP_RUNS
    try {
      rmSync(join(root, fw, 'dist'), { recursive: true, force: true })
      const start = performance.now()
      execSync('pnpm build', { cwd: join(root, fw), stdio: 'pipe' })
      const ms = performance.now() - start
      if (!warmup) times.push(ms)
      console.log(`  [${fw}] ${warmup ? `Warm-up ${i + 1}/${WARMUP_RUNS}` : `Run ${i - WARMUP_RUNS + 1}/${BUILD_RUNS}`}: ${Math.round(ms)}ms`)
    } catch (err) {
      console.error(`  [${fw}] Build run ${i + 1} failed:`, (err as Error).message.slice(0, 200))
      return 'BUILD_FAILED'
    }
  }
  return {
    runsMs: times.map(Math.round),
    minMs: Math.round(Math.min(...times)),
    maxMs: Math.round(Math.max(...times)),
    warmupRuns: WARMUP_RUNS,
  }
}

// All JavaScript the build ships: .js files in dist plus inline <script> bodies.
function shippedJsBytes(dir: string): number {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) total += shippedJsBytes(full)
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) total += statSync(full).size
    else if (entry.name.endsWith('.html')) {
      for (const m of readFileSync(full, 'utf8').matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) {
        total += Buffer.byteLength(m[1])
      }
    }
  }
  return total
}

const PACKAGE: Record<Framework, string> = { wald: '@waldjs/cli', astro: 'astro', eleventy: '@11ty/eleventy' }

function installedVersion(fw: Framework): string | undefined {
  try {
    return JSON.parse(readFileSync(join(root, fw, 'node_modules', PACKAGE[fw], 'package.json'), 'utf8')).version
  } catch {
    return undefined
  }
}

function startServer(distDir: string): Promise<ReturnType<typeof createServer>> {
  return new Promise((resolve) => {
    const handler = sirv(distDir, { extensions: ['html'] })
    const server = createServer(handler)
    // Port 0 = any free port, so a dev server already on 4321 can't break the run.
    server.listen(0, () => resolve(server))
  })
}

async function runLighthouse(fw: Framework): Promise<LighthouseScores | 'LIGHTHOUSE_FAILED'> {
  const distDir = join(root, fw, 'dist')
  const server = await startServer(distDir)
  const port = (server.address() as { port: number }).port
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
      const result = await lighthouse(`http://localhost:${port}${page}`, {
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

    const build = timeBuild(fw)
    const buildMs = build === 'BUILD_FAILED' ? 'BUILD_FAILED' : Math.round(median(build.runsMs))
    console.log(`  Build median: ${buildMs === 'BUILD_FAILED' ? 'FAILED' : `${buildMs}ms (min ${build !== 'BUILD_FAILED' ? build.minMs : '-'}, max ${build !== 'BUILD_FAILED' ? build.maxMs : '-'})`}`)

    let lighthouseResult: LighthouseScores | 'LIGHTHOUSE_FAILED' = 'LIGHTHOUSE_FAILED'
    const jsBytes = buildMs !== 'BUILD_FAILED' ? shippedJsBytes(join(root, fw, 'dist')) : undefined
    if (jsBytes !== undefined) console.log(`  Shipped JS: ${(jsBytes / 1024).toFixed(2)} KB`)
    if (buildMs !== 'BUILD_FAILED' && !process.env.BENCH_SKIP_LIGHTHOUSE) {
      console.log(`  Lighthouse on ${PAGES[fw].length} pages...`)
      lighthouseResult = await runLighthouse(fw)
      if (lighthouseResult !== 'LIGHTHOUSE_FAILED') {
        console.log(
          `  Perf: ${lighthouseResult.performance}  A11y: ${lighthouseResult.accessibility}  Best: ${lighthouseResult.bestPractices}  SEO: ${lighthouseResult.seo}`,
        )
      }
    }

    results[fw] = {
      buildMs,
      ...(build !== 'BUILD_FAILED' ? { build } : {}),
      version: installedVersion(fw),
      jsBytes,
      lighthouse: lighthouseResult,
    }
  }

  mkdirSync(join(root, 'results'), { recursive: true })
  const environment = {
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
  }
  const posts = readdirSync(join(root, 'content/blog')).length
  const output = { timestamp: new Date().toISOString(), posts, environment, results }
  const file = posts === 50 ? 'results/latest.json' : `results/latest-${posts}.json`
  writeFileSync(join(root, file), JSON.stringify(output, null, 2))
  console.log(`\nResults saved to ${file}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
