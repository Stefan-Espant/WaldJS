import { mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'

export async function scaffold(targetDir: string): Promise<void> {
  const name = basename(targetDir)

  mkdirSync(join(targetDir, 'src', 'pages'), { recursive: true })

  writeFileSync(
    join(targetDir, 'src', 'pages', 'index.wald'),
    `---\nconst title = "Hello Wald"\n---\n<h1>{title}</h1>\n<p>Welcome to your forest.</p>\n`
  )

  writeFileSync(
    join(targetDir, 'package.json'),
    JSON.stringify(
      {
        name,
        private: true,
        type: 'module',
        scripts: {
          dev: 'wald grow',
          build: 'wald build',
          preview: 'wald preview',
        },
        dependencies: {
          '@waldjs/cli': 'latest',
        },
      },
      null,
      2
    ) + '\n'
  )

  writeFileSync(join(targetDir, '.gitignore'), 'node_modules\ndist\n.env\n.DS_Store\n')
}

export const plantCommand = defineCommand({
  meta: { description: 'Create a new WaldJS project' },
  args: {
    name: { type: 'positional', description: 'Project name', required: true },
  },
  async run({ args }) {
    const targetDir = join(process.cwd(), args.name)
    const spinner = ora(`Creating ${args.name}...`).start()
    await scaffold(targetDir)
    spinner.succeed(`Created ${args.name}`)
    console.log(`\n  cd ${args.name}`)
    console.log(`  pnpm install`)
    console.log(`  pnpm dev`)
  },
})
