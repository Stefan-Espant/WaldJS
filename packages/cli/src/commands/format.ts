import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineCommand } from 'citty'
import { format } from '@waldjs/compiler'

const IGNORED_DIRECTORIES = new Set(['.git', '.turbo', 'dist', 'node_modules'])

export type FormatResult = {
  files: string[]
  changed: string[]
}

export function findWaldFiles(paths: string[]): string[] {
  const files = new Set<string>()

  const visit = (path: string): void => {
    if (!existsSync(path)) throw new Error(`Path does not exist: ${path}`)
    const stat = statSync(path)
    if (stat.isFile()) {
      if (path.endsWith('.wald')) files.add(resolve(path))
      return
    }
    if (!stat.isDirectory()) return

    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue
      if (entry.isSymbolicLink()) continue
      visit(resolve(path, entry.name))
    }
  }

  for (const path of paths) visit(resolve(path))
  return [...files].sort()
}

export function runFormat(paths: string[], check = false): FormatResult {
  const files = findWaldFiles(paths.length ? paths : [process.cwd()])
  const changed: string[] = []

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const formatted = format(source)
    if (formatted === source) continue
    changed.push(file)
    if (!check) writeFileSync(file, formatted)
  }

  return { files, changed }
}

export const formatCommand = defineCommand({
  meta: { name: 'format', description: 'Format .wald files' },
  args: {
    path: { type: 'positional', description: 'File or directory (defaults to the current directory)', required: false },
    check: { type: 'boolean', description: 'Check formatting without writing files', default: false },
  },
  run({ args }) {
    const paths = args._.length ? args._ : [process.cwd()]
    try {
      const result = runFormat(paths, args.check)
      if (args.check && result.changed.length) {
        for (const file of result.changed) console.error(file)
        console.error(`✖ ${result.changed.length} .wald file${result.changed.length === 1 ? '' : 's'} need formatting`)
        process.exitCode = 1
        return
      }

      if (args.check) console.log(`✓ ${result.files.length} .wald file${result.files.length === 1 ? '' : 's'} formatted`)
      else console.log(`✓ Formatted ${result.changed.length} of ${result.files.length} .wald file${result.files.length === 1 ? '' : 's'}`)
    } catch (error) {
      console.error(`[waldjs] ${(error as Error).message}`)
      process.exitCode = 1
    }
  },
})
