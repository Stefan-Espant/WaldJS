import { parse, type ComponentNode, type ScriptNode, type TemplateNode } from '@waldjs/compiler'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export type CanopyScanResult = {
  entries: Map<string, string>
  warnings: string[]
}

export function scanCanopyEntries(srcDir: string): CanopyScanResult {
  const entries = new Map<string, string>()
  const warnings: string[] = []

  for (const file of walkWaldFiles(srcDir)) {
    const ast = parse(readFileSync(file, 'utf8'))
    for (const usage of findCanopyUsages(ast.template)) {
      const componentPath = resolveImportPath(ast.frontmatter.code, usage.name, file)
      if (!componentPath) continue

      const componentAst = parse(readFileSync(componentPath, 'utf8'))
      if (!hasScriptBlock(componentAst.template)) {
        warnings.push(`${usage.name} has no <script> block — canopy:${usage.canopy!.strategy} has no effect`)
        continue
      }

      entries.set(usage.name.toLowerCase(), componentPath)
    }
  }

  return { entries, warnings }
}

export function collectCanopyScriptContents(entries: Map<string, string>): Set<string> {
  const contents = new Set<string>()
  for (const file of entries.values()) {
    const ast = parse(readFileSync(file, 'utf8'))
    const scriptNode = ast.template.find((node): node is ScriptNode => node.type === 'script')
    if (scriptNode) contents.add(scriptNode.content)
  }
  return contents
}

function walkWaldFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkWaldFiles(full))
    } else if (entry.name.endsWith('.wald')) {
      files.push(full)
    }
  }
  return files
}

function findCanopyUsages(nodes: TemplateNode[]): ComponentNode[] {
  const found: ComponentNode[] = []
  for (const node of nodes) {
    if (node.type === 'component') {
      if (node.canopy) found.push(node)
      found.push(...findCanopyUsages(node.children))
    } else if (node.type === 'element') {
      found.push(...findCanopyUsages(node.children))
    }
  }
  return found
}

function hasScriptBlock(nodes: TemplateNode[]): boolean {
  return nodes.some(node => node.type === 'script' || (node.type === 'element' && hasScriptBlock(node.children)))
}

function resolveImportPath(frontmatterCode: string, componentName: string, fromFile: string): string | undefined {
  const re = new RegExp(`import\\s+${componentName}\\s+from\\s+['"](.+?)['"]`)
  const match = frontmatterCode.match(re)
  if (!match) return undefined
  return resolve(dirname(fromFile), match[1])
}
