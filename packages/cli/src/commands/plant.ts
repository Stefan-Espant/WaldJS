import { mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { defineCommand } from 'citty'
import ora from 'ora'

export async function scaffold(targetDir: string): Promise<void> {
  const name = basename(targetDir)

  mkdirSync(join(targetDir, 'src', 'pages', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'layouts'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'components'), { recursive: true })
  mkdirSync(join(targetDir, 'content', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'public'), { recursive: true })

  writeFileSync(
    join(targetDir, 'src', 'layouts', 'Layout.wald'),
    [
      '---',
      'const { title, pond } = $$props',
      '---',
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width" />',
      '    <title>{title}</title>',
      '  </head>',
      '  <body>',
      '    {pond}',
      '  </body>',
      '</html>',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'components', 'Card.wald'),
    [
      '---',
      'const { title, body } = $$props',
      '---',
      '<article>',
      '  <h2>{title}</h2>',
      '  <p>{body}</p>',
      '</article>',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'components', 'Counter.wald'),
    [
      '---',
      'const { initial = 0 } = $$props',
      '---',
      '<div class="counter" data-count="{initial}">',
      '  <span class="counter-value">{initial}</span>',
      '  <button class="counter-btn">+</button>',
      '</div>',
      '<script>',
      "  document.querySelectorAll('.counter').forEach(function(el) {",
      "    var count = parseInt(el.dataset.count, 10)",
      "    el.querySelector('.counter-btn').addEventListener('click', function() {",
      '      count++',
      "      el.querySelector('.counter-value').textContent = count",
      '    })',
      '  })',
      '</script>',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'index.wald'),
    [
      '---',
      "import Layout from '../layouts/Layout.wald'",
      "import Card from '../components/Card.wald'",
      "import Counter from '../components/Counter.wald'",
      "const title = 'Hello Wald'",
      '---',
      '<Layout title={title}>',
      '  <Card title="Welkom" body="Je eerste WaldJS project." />',
      '  <Counter initial={3} />',
      '</Layout>',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'blog', 'index.wald'),
    [
      '---',
      "import Layout from '../../layouts/Layout.wald'",
      "import { getCollection } from 'wald:content'",
      "const posts = await getCollection('blog')",
      "const count = posts.length",
      '---',
      '<Layout title="Blog">',
      '  <h1>Blog</h1>',
      '  <p>Found {count} posts</p>',
      '</Layout>',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'pages', 'blog', '[slug].wald'),
    [
      '---',
      "import Layout from '../../layouts/Layout.wald'",
      "import { getCollection, getEntry } from 'wald:content'",
      'export async function getStaticPaths() {',
      "  const posts = await getCollection('blog')",
      '  return posts.map(p => ({ params: { slug: p.slug } }))',
      '}',
      "const post = await getEntry('blog', $$props.slug)",
      '---',
      '<Layout title={post.data.title}>',
      '  <h1>{post.data.title}</h1>',
      '  {post.body}',
      '</Layout>',
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
