import { mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'

export async function scaffold(targetDir: string): Promise<void> {
  const name = basename(targetDir)

  mkdirSync(join(targetDir, 'src', 'pages', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'content', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'public'), { recursive: true })

  writeFileSync(
    join(targetDir, 'src', 'pages', 'index.wald'),
    `---\nconst title = "Hello Wald"\n---\n<h1>{title}</h1>\n<p>Welcome to your forest.</p>\n`
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'blog', 'index.wald'),
    [
      '---',
      "import { getCollection } from 'wald:content'",
      "const posts = await getCollection('blog')",
      '---',
      '<h1>Blog</h1>',
      "<ul>{posts.map(p => `<li><a href=\"/blog/${p.slug}\">${p.data.title}</a></li>`).join('')}</ul>",
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'blog', '[slug].wald'),
    [
      '---',
      "import { getCollection, getEntry } from 'wald:content'",
      'export async function getStaticPaths() {',
      "  const posts = await getCollection('blog')",
      '  return posts.map(p => ({ params: { slug: p.slug } }))',
      '}',
      "const post = await getEntry('blog', $$props.slug)",
      '---',
      '<h1>{post.data.title}</h1>',
      '<div>{post.body}</div>',
      '',
    ].join('\n')
  )

  const today = new Date().toISOString().slice(0, 10)
  writeFileSync(
    join(targetDir, 'content', 'blog', 'hello-world.md'),
    `---\ntitle: Hello World\ndate: ${today}\n---\n\nWelcome to your first post.\n`
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
