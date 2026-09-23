#!/usr/bin/env node
// Generates dist/sitemap.xml by scanning the already-BUILT dist/ directory
// for real generated pages (any index.html), rather than src/pages/ source
// files. This must run after `wald build`, not before — that's already how
// it's wired into marketing/package.json's build script. Scanning the real
// output means dynamically-generated routes (e.g. changelog/[slug] resolved
// via getStaticPaths()) are included automatically, with no need to
// reimplement route resolution here.
import { readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.argv[2] ?? process.cwd()
const baseUrl = (process.argv[3] ?? 'https://waldjs.steefan.nl').replace(/\/$/, '')
const distDir = join(root, 'dist')

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function walkDir(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(full))
    } else if (entry.name === 'index.html') {
      files.push(full)
    }
  }
  return files
}

function fileToRoute(file) {
  const rel = relative(distDir, file).replace(/\\/g, '/')
  const withoutIndex = rel.slice(0, -'index.html'.length) // '' for the root page, 'about/' for nested
  return '/' + withoutIndex
}

const routes = walkDir(distDir)
  .map(fileToRoute)
  .map((route) => route.replace(/\/$/, '') || '/')
  .sort()

const urls = routes
  .map((route) => `  <url><loc>${escapeXml(baseUrl + route)}</loc></url>`)
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

writeFileSync(join(distDir, 'sitemap.xml'), xml)
console.log(`sitemap: ${routes.length} route${routes.length === 1 ? '' : 's'} -> dist/sitemap.xml`)
