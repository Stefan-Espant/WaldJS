import ts from 'typescript'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileWithMap } from '@waldjs/compiler'

export interface CheckDiagnostic {
  file: string
  line: number
  column: number
  message: string
}

const CONTENT_SHIM = `declare module 'wald:content' {
  export type Entry = {
    slug: string
    data: Record<string, unknown>
    body: string
  }
  export function getCollection(name: string): Promise<Entry[]>
  export function getEntry(collection: string, slug: string): Promise<Entry>
}
`

type VirtualFile = {
  code: string
  lineMap: (number | null)[]
  original: string
  originalSource: string
}

export function checkProject(root: string): CheckDiagnostic[] {
  const srcDir = join(root, 'src')
  const waldFiles = existsSync(srcDir) ? findFiles(srcDir, '.wald') : []
  const tsFiles = existsSync(srcDir) ? findFiles(srcDir, '.ts') : []

  const virtuals = new Map<string, VirtualFile>()
  for (const file of waldFiles) {
    const source = readFileSync(file, 'utf-8')
    const { code, lineMap } = compileWithMap(source, file)
    virtuals.set(`${file}.ts`, { code, lineMap, original: file, originalSource: source })
  }

  const shimPath = join(root, '__wald_content__.d.ts')
  const options = loadTsOptions(root)
  const host = createVirtualHost(options, virtuals, shimPath)

  const rootNames = [...virtuals.keys(), ...tsFiles, shimPath]
  const program = ts.createProgram({ rootNames, options, host })

  const rootSet = new Set(rootNames.filter(f => f !== shimPath))
  const diagnostics: CheckDiagnostic[] = []

  for (const sf of program.getSourceFiles()) {
    if (!rootSet.has(sf.fileName)) continue
    const fileDiags = [
      ...program.getSyntacticDiagnostics(sf),
      ...program.getSemanticDiagnostics(sf),
    ]
    for (const diag of fileDiags) {
      if (diag.file === undefined || diag.start === undefined) continue
      diagnostics.push(remapDiagnostic(diag, virtuals))
    }
  }

  return diagnostics
}

function remapDiagnostic(
  diag: ts.Diagnostic,
  virtuals: Map<string, VirtualFile>,
): CheckDiagnostic {
  const sf = diag.file!
  const { line, character } = ts.getLineAndCharacterOfPosition(sf, diag.start!)
  const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n')
  const virtual = virtuals.get(sf.fileName)

  if (!virtual) {
    return { file: sf.fileName, line: line + 1, column: character + 1, message }
  }

  const originalLine = virtual.lineMap[line]
  if (originalLine === null || originalLine === undefined) {
    return { file: virtual.original, line: 1, column: 1, message }
  }

  const outputLineText = virtual.code.split('\n')[line] ?? ''
  const originalLineText = virtual.originalSource.split('\n')[originalLine - 1] ?? ''
  const outIndent = outputLineText.length - outputLineText.trimStart().length
  const origIndent = originalLineText.length - originalLineText.trimStart().length
  const column = Math.max(1, character + 1 - (outIndent - origIndent))

  return { file: virtual.original, line: originalLine, column, message }
}

function createVirtualHost(
  options: ts.CompilerOptions,
  virtuals: Map<string, VirtualFile>,
  shimPath: string,
): ts.CompilerHost {
  const host = ts.createCompilerHost(options)

  const origReadFile = host.readFile.bind(host)
  host.readFile = (fileName) => {
    const v = virtuals.get(fileName)
    if (v) return v.code
    if (fileName === shimPath) return CONTENT_SHIM
    return origReadFile(fileName)
  }

  const origFileExists = host.fileExists.bind(host)
  host.fileExists = (fileName) =>
    virtuals.has(fileName) || fileName === shimPath || origFileExists(fileName)

  const origGetSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreate) => {
    const v = virtuals.get(fileName)
    if (v) return ts.createSourceFile(fileName, v.code, languageVersionOrOptions)
    if (fileName === shimPath) return ts.createSourceFile(fileName, CONTENT_SHIM, languageVersionOrOptions)
    return origGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreate)
  }

  return host
}

// Locate @waldjs/runtime's type declarations by walking node_modules upward
// from this file. require.resolve is not usable here: the runtime's exports
// map has no "require" condition, so createRequire().resolve throws.
function resolveRuntimeTypes(): string | undefined {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (true) {
    const candidate = join(dir, 'node_modules', '@waldjs', 'runtime', 'dist', 'index.d.ts')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

function loadTsOptions(root: string): ts.CompilerOptions {
  const runtimeTypes = resolveRuntimeTypes()

  let options: ts.CompilerOptions
  const configPath = join(root, 'tsconfig.json')
  if (existsSync(configPath)) {
    const cfg = ts.readConfigFile(configPath, ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(cfg.config ?? {}, ts.sys, root)
    options = parsed.options
  } else {
    options = {
      strict: true,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      skipLibCheck: true,
    }
  }

  return {
    ...options,
    noEmit: true,
    baseUrl: options.baseUrl ?? root,
    ...(runtimeTypes
      ? { paths: { ...options.paths, '@waldjs/runtime': [runtimeTypes] } }
      : {}),
  }
}

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) results.push(...findFiles(full, ext))
    else if (entry.name.endsWith(ext)) results.push(full)
  }
  return results
}
