import { mkdirSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { spawnSync } from 'node:child_process'
import { defineCommand } from 'citty'
import ora from 'ora'

type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent ?? ''
  if (userAgent.startsWith('pnpm')) return 'pnpm'
  if (userAgent.startsWith('yarn')) return 'yarn'
  if (userAgent.startsWith('bun')) return 'bun'
  return 'npm'
}

function installCommand(pm: PackageManager): [string, string[]] {
  return [pm, ['install']]
}

function devCommand(pm: PackageManager): string {
  return pm === 'npm' ? 'npm run dev' : `${pm} dev`
}

export async function scaffold(targetDir: string): Promise<void> {
  const name = basename(targetDir)

  mkdirSync(join(targetDir, 'src', 'pages', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'layouts'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'components'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'assets', 'css'), { recursive: true })
  mkdirSync(join(targetDir, 'content', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'public'), { recursive: true })

  writeFileSync(
    join(targetDir, 'src', 'assets', 'css', 'global.css'),
    [
      ':root {',
      '  --wald-groen: #023B2D;',
      '  --wald-groen-donker: #01271D;',
      '  --wald-groen-licht: #0A5240;',
      '  --wald-rood: #FF3347;',
      '  --wald-rood-licht: #FF5B6C;',
      '  --wald-rood-donker: #D91A31;',
      '  --wald-wit: #FFFFFF;',
      '}',
      '',
      '* {',
      '  margin: 0;',
      '  padding: 0;',
      '  box-sizing: border-box;',
      '}',
      '',
      'body {',
      "  font-family: 'Baloo 2', system-ui, sans-serif;",
      '  background: radial-gradient(120% 100% at 50% -10%, var(--wald-groen-licht) 0%, var(--wald-groen) 55%, var(--wald-groen-donker) 100%);',
      '  color: var(--wald-wit);',
      '  line-height: 1.6;',
      '  min-height: 100vh;',
      '}',
      '',
      'a {',
      '  color: inherit;',
      '}',
      '',
      '.navbar {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  padding: 1rem 1.5rem;',
      '  border-bottom: 1px solid rgba(255, 255, 255, .12);',
      '}',
      '',
      '.navbar .logo {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: .5rem;',
      '  font-weight: 800;',
      '  text-decoration: none;',
      '  color: var(--wald-wit);',
      '}',
      '',
      '.navbar .navlinks {',
      '  display: flex;',
      '  gap: 1.25rem;',
      '}',
      '',
      '.navbar .navlinks a {',
      '  text-decoration: none;',
      '  color: rgba(255, 255, 255, .72);',
      '  font-size: .9rem;',
      '}',
      '',
      '.navbar .navlinks a:hover {',
      '  color: var(--wald-wit);',
      '}',
      '',
      '.hero {',
      '  text-align: center;',
      '  padding: 4rem 1.5rem 3rem;',
      '  max-width: 40rem;',
      '  margin: 0 auto;',
      '}',
      '',
      '.hero .eyebrow {',
      '  color: var(--wald-rood-licht);',
      '  font-weight: 800;',
      '  font-size: .75rem;',
      '  letter-spacing: .08em;',
      '  text-transform: uppercase;',
      '}',
      '',
      '.hero h1 {',
      '  font-size: 2.25rem;',
      '  font-weight: 800;',
      '  line-height: 1.08;',
      '  margin: .75rem 0;',
      '}',
      '',
      '.hero .hero-sub {',
      '  color: rgba(255, 255, 255, .72);',
      '  font-size: .95rem;',
      '  margin-bottom: 1.5rem;',
      '}',
      '',
      '.btn {',
      '  display: inline-block;',
      '  position: relative;',
      '  background: linear-gradient(180deg, var(--wald-rood-licht) 0%, var(--wald-rood) 58%, var(--wald-rood-donker) 100%);',
      '  color: var(--wald-wit);',
      '  text-decoration: none;',
      '  font-weight: 700;',
      '  font-size: .875rem;',
      '  padding: .75rem 1.5rem;',
      '  border-radius: 999px;',
      '  border: 1px solid rgba(255, 255, 255, .16);',
      '  box-shadow:',
      '    inset 0 1px 0 rgba(255, 255, 255, .28),',
      '    inset 0 -3px 0 rgba(120, 0, 18, .25),',
      '    0 6px 0 rgba(122, 10, 24, .55),',
      '    0 12px 24px rgba(255, 51, 71, .32);',
      '}',
      '',
      '.btn::before {',
      '  content: "";',
      '  position: absolute;',
      '  left: 10%;',
      '  right: 10%;',
      '  top: 8%;',
      '  height: 46%;',
      '  border-radius: 999px;',
      '  background: linear-gradient(180deg, rgba(255, 255, 255, .34), rgba(255, 255, 255, 0));',
      '  pointer-events: none;',
      '}',
      '',
      '.features {',
      '  display: flex;',
      '  gap: 1rem;',
      '  max-width: 56rem;',
      '  margin: 0 auto;',
      '  padding: 0 1.5rem 3rem;',
      '  flex-wrap: wrap;',
      '}',
      '',
      '.card {',
      '  flex: 1;',
      '  min-width: 12rem;',
      '  border-radius: .875rem;',
      '  padding: 1.25rem;',
      '  background: linear-gradient(180deg, rgba(255, 255, 255, .09), rgba(255, 255, 255, .045));',
      '  border: 1px solid rgba(255, 255, 255, .12);',
      '  box-shadow:',
      '    inset 0 1px 0 rgba(255, 255, 255, .12),',
      '    0 5px 0 rgba(0, 0, 0, .12),',
      '    0 14px 28px rgba(0, 0, 0, .16);',
      '  text-decoration: none;',
      '  display: block;',
      '}',
      '',
      '.card .card-icon {',
      '  width: 1.75rem;',
      '  height: 1.75rem;',
      '  border-radius: .5625rem;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  margin-bottom: .625rem;',
      '  background: linear-gradient(180deg, var(--wald-rood-licht), var(--wald-rood-donker));',
      '  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .4), 0 3px 6px rgba(0, 0, 0, .25);',
      '}',
      '',
      '.card h3 {',
      '  font-size: .95rem;',
      '  margin-bottom: .25rem;',
      '}',
      '',
      '.card p {',
      '  font-size: .8rem;',
      '  color: rgba(255, 255, 255, .6);',
      '}',
      '',
      '.counter-demo {',
      '  text-align: center;',
      '  padding: 0 1.5rem 4rem;',
      '}',
      '',
      '.counter-demo > p {',
      '  display: inline;',
      '  margin-right: .5rem;',
      '  color: rgba(255, 255, 255, .72);',
      '  font-size: .875rem;',
      '}',
      '',
      '.counter {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: .625rem;',
      '  background: linear-gradient(180deg, rgba(255, 255, 255, .09), rgba(255, 255, 255, .045));',
      '  border: 1px solid rgba(255, 255, 255, .12);',
      '  border-radius: 999px;',
      '  padding: .5rem .5rem .5rem 1rem;',
      '  box-shadow:',
      '    inset 0 1px 0 rgba(255, 255, 255, .12),',
      '    0 4px 0 rgba(0, 0, 0, .12),',
      '    0 10px 18px rgba(0, 0, 0, .16);',
      '}',
      '',
      '.counter-btn {',
      '  width: 1.75rem;',
      '  height: 1.75rem;',
      '  border-radius: 50%;',
      '  border: none;',
      '  color: var(--wald-wit);',
      '  font-weight: 800;',
      '  cursor: pointer;',
      '  background: linear-gradient(180deg, var(--wald-rood-licht), var(--wald-rood-donker));',
      '  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .4), 0 3px 6px rgba(0, 0, 0, .25);',
      '}',
      '',
      '.page-header {',
      '  max-width: 40rem;',
      '  margin: 0 auto;',
      '  padding: 3rem 1.5rem 2rem;',
      '  text-align: center;',
      '}',
      '',
      '.page-header h1 {',
      '  font-size: 1.75rem;',
      '  font-weight: 800;',
      '  margin-bottom: .5rem;',
      '}',
      '',
      '.page-header p {',
      '  color: rgba(255, 255, 255, .72);',
      '  font-size: .9rem;',
      '}',
      '',
      '.post-list {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: .75rem;',
      '  max-width: 40rem;',
      '  margin: 0 auto;',
      '  padding: 0 1.5rem 3rem;',
      '}',
      '',
      '.post {',
      '  border-radius: .875rem;',
      '  padding: 1.25rem;',
      '  background: linear-gradient(180deg, rgba(255, 255, 255, .09), rgba(255, 255, 255, .045));',
      '  border: 1px solid rgba(255, 255, 255, .12);',
      '  text-decoration: none;',
      '  display: block;',
      '}',
      '',
      '.post h3 {',
      '  font-size: 1rem;',
      '}',
      '',
      '.post-body {',
      '  max-width: 36rem;',
      '  margin: 0 auto;',
      '  padding: 3rem 1.5rem;',
      '}',
      '',
      '.post-body h1 {',
      '  font-size: 1.75rem;',
      '  margin-bottom: 1rem;',
      '}',
      '',
      '.site-footer {',
      '  text-align: center;',
      '  padding: 2rem 1.5rem;',
      '  color: rgba(255, 255, 255, .5);',
      '  font-size: .8rem;',
      '  border-top: 1px solid rgba(255, 255, 255, .12);',
      '}',
      '',
    ].join('\n')
  )

  writeFileSync(
    join(targetDir, 'src', 'components', 'TreeMark.wald'),
    [
      '---',
      '---',
      '<svg class="tree-mark" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
      '  <polygon points="12,2 6,10 18,10" fill="#FF3347" />',
      '  <polygon points="12,7 5,16 19,16" fill="#FF3347" />',
      '  <rect x="11" y="16" width="2" height="5" fill="#FF3347" />',
      '</svg>',
      '',
    ].join('\n')
  )

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

    const pm = detectPackageManager()
    const [cmd, cmdArgs] = installCommand(pm)
    const installSpinner = ora(`Installing dependencies with ${pm}...`).start()
    const result = spawnSync(cmd, cmdArgs, { cwd: targetDir, stdio: 'ignore', shell: process.platform === 'win32' })

    if (result.status === 0) {
      installSpinner.succeed('Installed dependencies')
      console.log(`\n  cd ${args.name}`)
      console.log(`  ${devCommand(pm)}`)
    } else {
      installSpinner.fail(`Could not install dependencies automatically`)
      console.log(`\n  cd ${args.name}`)
      console.log(`  ${cmd} ${cmdArgs.join(' ')}`)
      console.log(`  ${devCommand(pm)}`)
    }
  },
})
