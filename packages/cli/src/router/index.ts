import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

export type Route = {
  pattern: string
  file: string
  params: string[]
}

export function scanRoutes(pagesDir: string): Route[] {
  return walkDir(pagesDir).map(file => fileToRoute(pagesDir, file))
}

export function matchRoute(
  routes: Route[],
  url: string
): { route: Route; params: Record<string, string> } | null {
  const pathname = url.split('?')[0]
  for (const route of routes) {
    const params = matchPattern(route.pattern, pathname)
    if (params !== null) return { route, params }
  }
  return null
}

function walkDir(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(full))
    } else if (entry.name.endsWith('.wald')) {
      files.push(full)
    }
  }
  return files
}

function fileToRoute(pagesDir: string, file: string): Route {
  const rel = relative(pagesDir, file).replace(/\\/g, '/')
  const withoutExt = rel.slice(0, -'.wald'.length)
  const segments = withoutExt.split('/')

  if (segments[segments.length - 1] === 'index') {
    segments.pop()
  }

  const params: string[] = []
  const patternSegments = segments.map(seg => {
    const match = seg.match(/^\[(\w+)\]$/)
    if (match) {
      params.push(match[1])
      return `:${match[1]}`
    }
    return seg
  })

  return {
    pattern: '/' + patternSegments.join('/'),
    file,
    params,
  }
}

function matchPattern(pattern: string, url: string): Record<string, string> | null {
  const ps = pattern.split('/').filter(Boolean)
  const us = url.split('/').filter(Boolean)
  if (ps.length !== us.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].startsWith(':')) {
      params[ps[i].slice(1)] = us[i]
    } else if (ps[i] !== us[i]) {
      return null
    }
  }
  return params
}
