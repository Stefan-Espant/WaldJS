import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { defineCommand } from 'citty'
import { checkProject, type CheckDiagnostic } from '../checker.js'

export function renderDiagnostic(diag: CheckDiagnostic, source: string): string {
  const lines = source.split('\n')
  const current = lines[diag.line - 1] ?? ''
  const previous = diag.line >= 2 ? lines[diag.line - 2] : undefined
  const gutter = String(diag.line).length

  let out = `[waldjs] ${diag.file}:${diag.line}:${diag.column} — ${diag.message}\n\n`
  if (previous !== undefined) {
    out += `  ${String(diag.line - 1).padStart(gutter)} | ${previous}\n`
  }
  out += `  ${String(diag.line).padStart(gutter)} | ${current}\n`
  out += `  ${' '.repeat(gutter)} | ${' '.repeat(Math.max(0, diag.column - 1))}^\n`
  return out
}

export async function runCheck(root: string): Promise<boolean> {
  const diagnostics = checkProject(root)

  for (const diag of diagnostics) {
    let source = ''
    try {
      source = readFileSync(diag.file, 'utf-8')
    } catch {
      // file unreadable — render header without source context
    }
    const display = { ...diag, file: relative(root, diag.file) || diag.file }
    console.error(renderDiagnostic(display, source))
  }

  if (diagnostics.length > 0) {
    console.error(`✖ ${diagnostics.length} type error${diagnostics.length === 1 ? '' : 's'}`)
    return false
  }

  console.log('✓ No type errors')
  return true
}

export const checkCommand = defineCommand({
  meta: { name: 'check', description: 'Type-check .wald and .ts files' },
  async run() {
    const ok = await runCheck(process.cwd())
    if (!ok) process.exitCode = 1
  },
})
