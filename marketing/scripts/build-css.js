#!/usr/bin/env node
// Bundelt src/styles/site.css (een lijst van @import's) tot één geminificeerd
// bestand. De partials in src/styles/partials/ zijn de bron-van-waarheid voor
// developers — dit is het enige gegenereerde artefact, nooit gecommit.
//
// Doel hangt af van het argument:
//   node scripts/build-css.js dist    -> dist/css/site.css (na `wald build`, productie)
//   node scripts/build-css.js public  -> public/css/site.css (vóór `wald grow`, want Vite's
//                                        dev-server serveert statische bestanden uit public/)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const target = process.argv[2] === 'public' ? 'public' : 'dist'
const stylesDir = path.join(__dirname, '..', 'src', 'styles')
const outDir = path.join(__dirname, '..', target, 'css')
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

const bundled = resolveImports(entry)
const minified = minify(bundled)

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'site.css'), minified + '\n')

const kb = (Buffer.byteLength(minified) / 1024).toFixed(1)
console.log(`css gebundeld: ${kb} kB -> ${target}/css/site.css`)
