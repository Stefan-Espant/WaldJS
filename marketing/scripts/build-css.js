#!/usr/bin/env node
// Bundelt src/styles/site.css (een lijst van @import's) tot één geminificeerd
// bestand. De partials in src/styles/partials/ zijn de bron-van-waarheid voor
// developers — dit is het enige gegenereerde artefact, nooit gecommit.
//
// Doel hangt af van het argument:
//   node scripts/build-css.js dist    -> dist/css/site.css (na `wald build`, productie)
//   node scripts/build-css.js public  -> public/css/site.css (vóór `wald grow`, want Vite's
//                                        dev-server serveert statische bestanden uit public/)
//
// Met --watch blijft het proces draaien: het herbundelt automatisch bij elke
// wijziging in src/styles/ en start `wald grow` als kindproces na de eerste
// bundel, zodat `npm run dev` één commando blijft.

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const watch = args.includes('--watch')
const target = args.includes('public') ? 'public' : 'dist'
const rootDir = path.join(__dirname, '..')
const stylesDir = path.join(rootDir, 'src', 'styles')
const outDir = path.join(rootDir, target, 'css')
const entry = path.join(stylesDir, 'site.css')

function resolveImports(filePath, seen = new Set()) {
  if (seen.has(filePath)) return ''
  seen.add(filePath)
  const src = fs.readFileSync(filePath, 'utf-8')
  return src.replace(/@import\s+["']([^"']+)["'];/g, (_, rel) => {
    const resolved = path.resolve(path.dirname(filePath), rel)
    return resolveImports(resolved, seen)
  })
}

function minify(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')       // strip comments
    .replace(/\s+/g, ' ')                    // collapse whitespace
    .replace(/\s*([{}:;,])\s*/g, '$1')       // trim around structural chars
    .replace(/;}/g, '}')                     // drop redundant trailing semicolons
    .trim()
}

function build() {
  const bundled = resolveImports(entry)
  const minified = minify(bundled)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'site.css'), minified + '\n')
  const kb = (Buffer.byteLength(minified) / 1024).toFixed(1)
  console.log(`css gebundeld: ${kb} kB -> ${target}/css/site.css`)
}

build()

if (watch) {
  // Recursief watchen wordt door Node's fs.watch ondersteund op macOS en
  // moderne Linux-kernels (Node >= 20). Op oudere platforms zonder recursive-
  // support gooit dit een ERR_FEATURE_UNAVAILABLE_ON_PLATFORM — dan is de
  // fallback: dit script zonder --watch draaien en handmatig herbundelen.
  // (Dit is lokaal dev-gemak, geen productiecode.)
  let timer = null
  fs.watch(stylesDir, { recursive: true }, () => {
    // Korte debounce: editors schrijven soms meerdere keren per save.
    clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        build()
      } catch (err) {
        console.error(`css bundelen mislukt: ${err.message}`)
      }
    }, 75)
  })
  console.log(`css watcher actief op ${path.relative(rootDir, stylesDir)}/`)

  // Start `wald grow` als kindproces zodat één commando volstaat voor dev.
  // Voorkeur: de workspace-CLI via de @waldjs/cli-link in node_modules;
  // anders `wald` van het PATH (npm zet node_modules/.bin daar al op).
  const waldJs = [
    path.join(rootDir, 'node_modules', '@waldjs', 'cli', 'bin', 'wald.js'),
    path.join(rootDir, '..', 'node_modules', '@waldjs', 'cli', 'bin', 'wald.js'),
  ].find((p) => fs.existsSync(p))
  const child = waldJs
    ? spawn(process.execPath, [waldJs, 'grow'], { cwd: rootDir, stdio: 'inherit' })
    : spawn('wald', ['grow'], { cwd: rootDir, stdio: 'inherit' })

  // Ctrl+C / kill netjes doorsturen naar het kind; wij stoppen pas als het
  // kind gestopt is, zodat er nooit een wees-`wald grow` achterblijft.
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => child.kill(sig))
  }
  child.on('exit', (code, signal) => {
    process.exit(signal ? 0 : (code ?? 0))
  })
}
