import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { defineCommand } from 'citty'
import { formatFile, FORMAT_EXTENSIONS } from '@waldjs/compiler'

const IGNORED_DIRECTORIES = new Set(['.git', '.turbo', '.vercel', '.oester', '.wald-ssr', 'coverage', 'dist', 'node_modules'])

export type FormatResult = {
  files: string[]
  changed: string[]
}

function findFiles(paths: string[], extensions: readonly string[]): string[] {
  const files = new Set<string>()

  const visit = (path: string): void => {
    if (!existsSync(path)) throw new Error(`Path does not exist: ${path}`)
    const stat = statSync(path)
    if (stat.isFile()) {
      if (extensions.includes(extname(path).toLowerCase())) files.add(resolve(path))
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

export function findWaldFiles(paths: string[]): string[] {
  return findFiles(paths, ['.wald'])
}

export function findFormatFiles(paths: string[]): string[] {
  return findFiles(paths, FORMAT_EXTENSIONS)
}

export async function runFormat(paths: string[], check = false): Promise<FormatResult> {
  const files = findFormatFiles(paths.length ? paths : [process.cwd()])
  const changed: string[] = []

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    let formatted: string
    try {
      formatted = await formatFile(source, file)
    } catch (error) {
      throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (formatted === source) continue
    changed.push(file)
    if (!check) writeFileSync(file, formatted)
  }

  return { files, changed }
}

export const formatCommand = defineCommand({
  meta: { name: 'format', description: 'Format Wald, HTML, CSS, JavaScript and TypeScript files' },
  args: {
    path: { type: 'positional', description: 'File or directory (defaults to the current directory)', required: false },
    check: { type: 'boolean', description: 'Check formatting without writing files', default: false },
  },
  async run({ args }) {
    const paths = args._.length ? args._ : [process.cwd()]
    try {
      const result = await runFormat(paths, args.check)
      if (args.check && result.changed.length) {
        for (const file of result.changed) console.error(file)
        console.error(`✖ ${result.changed.length} file${result.changed.length === 1 ? '' : 's'} need formatting`)
        process.exitCode = 1
        return
      }

      if (args.check) console.log(`✓ ${result.files.length} file${result.files.length === 1 ? '' : 's'} formatted`)
      else console.log(`✓ Formatted ${result.changed.length} of ${result.files.length} file${result.files.length === 1 ? '' : 's'}`)
    } catch (error) {
      console.error(`[waldjs] ${(error as Error).message}`)
      process.exitCode = 1
    }
  },
})
