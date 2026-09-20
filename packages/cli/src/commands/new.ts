import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { defineCommand } from 'citty'

function titleCase(segment: string): string {
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function componentTemplate(name: string): string {
  return [
    '---',
    '// Add typed props here, e.g.:',
    '// type Props = { title: string }',
    '---',
    `<div class="${name}">`,
    `  <!-- ${name} -->`,
    '</div>',
    '',
  ].join('\n')
}

export function pageTemplate(route: string): string {
  const params = [...route.matchAll(/\[(\w+)\]/g)].map((m) => m[1])

  if (params.length === 0) {
    const title = titleCase(route.split('/').pop() ?? route)
    return ['---', `const title = '${title}'`, '---', '<h1>{title}</h1>', ''].join('\n')
  }

  const propsType = `{ ${params.map((p) => `${p}: string`).join('; ')} }`
  return [
    '---',
    `type Props = ${propsType}`,
    '',
    'export async function getStaticPaths() {',
    '  return []',
    '}',
    '---',
    `<h1>{$$props.${params[0]}}</h1>`,
    '',
  ].join('\n')
}

export function componentPath(cwd: string, name: string): string {
  return join(cwd, 'src', 'components', `${name}.wald`)
}

export function pagePath(cwd: string, route: string): string {
  return join(cwd, 'src', 'pages', `${route}.wald`)
}

export function writeGenerated(path: string, content: string): void {
  if (existsSync(path)) {
    throw new Error(`${path} already exists — refusing to overwrite it.`)
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

const newComponentCommand = defineCommand({
  meta: { description: 'Scaffold a new component in src/components/' },
  args: {
    name: { type: 'positional', description: 'Component name, e.g. Foo', required: true },
  },
  run({ args }) {
    const name: string = args.name
    const path = componentPath(process.cwd(), name)
    try {
      writeGenerated(path, componentTemplate(name))
    } catch (e) {
      console.error(`[waldjs] ${(e as Error).message}`)
      process.exitCode = 1
      return
    }
    console.log(`✔ Created ${path}`)
  },
})

const newPageCommand = defineCommand({
  meta: { description: 'Scaffold a new page in src/pages/' },
  args: {
    route: { type: 'positional', description: 'Route, e.g. about or blog/[slug]', required: true },
  },
  run({ args }) {
    const route: string = args.route
    const path = pagePath(process.cwd(), route)
    try {
      writeGenerated(path, pageTemplate(route))
    } catch (e) {
      console.error(`[waldjs] ${(e as Error).message}`)
      process.exitCode = 1
      return
    }
    console.log(`✔ Created ${path}`)
  },
})

export const newCommand = defineCommand({
  meta: { description: 'Scaffold a new component or page' },
  subCommands: {
    component: newComponentCommand,
    page: newPageCommand,
  },
})
