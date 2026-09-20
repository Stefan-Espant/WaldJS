# Scaffold Starter Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `npm create wald@latest` / `wald plant` scaffold a visually polished, WaldJS-branded starter (dark green gradient, glossy red 3D buttons/cards, Baloo 2 typography) instead of unstyled default HTML, across all three generated pages (home, blog index, blog post).

**Architecture:** All generated file content lives in `packages/cli/src/commands/plant.ts`'s `scaffold()` function as template literal strings written via `writeFileSync`. This plan adds two new generated files (a stylesheet, a logo component) and rewrites the content of five existing ones (`Layout.wald`, `Card.wald`, `index.wald`, `blog/index.wald`, `blog/[slug].wald`). `Counter.wald`'s content is untouched — only styled via the new global stylesheet.

**Tech Stack:** TypeScript, Vitest, the WaldJS compiler/CLI itself (dogfooding — the scaffold output must compile and build with the real `wald` CLI).

**Full design context:** `docs/superpowers/specs/2026-07-26-scaffold-starter-redesign-design.md` — read this first if anything below is unclear about *why*, not just *what*.

---

## Before you start

All work happens in `packages/cli/src/commands/plant.ts` and `packages/cli/src/commands/plant.test.ts`. Read both files in full before starting — you'll be inserting into and rewriting parts of `scaffold()`, and the existing tests must keep passing.

Run the existing test suite once first to confirm a clean baseline:

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts
```

Expected: `8 passed`.

---

### Task 1: Generate the global stylesheet

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Test: `packages/cli/src/commands/plant.test.ts`

The stylesheet must live at `src/assets/css/global.css` — not `src/styles/`. Both `wald grow` (see `grow.ts`, which mounts `sirv` on `src` only for requests starting with `/assets/`) and `wald build` (see `build.ts`'s `assetsDir = join(srcDir, 'assets')`) only serve/copy `src/assets/**`. Anything under `src/styles/` would 404 in dev and be silently dropped from the production build.

- [ ] **Step 1: Write the failing test**

Add this test to `packages/cli/src/commands/plant.test.ts`, inside the existing `describe('scaffold', ...)` block (add it after the last existing `it(...)`):

```ts
  it('creates src/assets/css/global.css with the brand color tokens', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'assets', 'css', 'global.css'), 'utf8')
    expect(content).toContain('#FF3347')
    expect(content).toContain('#023B2D')
    expect(content).toContain('.btn')
    expect(content).toContain('.card')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "global.css"
```

Expected: FAIL with `ENOENT` (file doesn't exist).

- [ ] **Step 3: Write minimal implementation**

In `packages/cli/src/commands/plant.ts`, add `src/assets/css` to the directories created near the top of `scaffold()`. Find:

```ts
  mkdirSync(join(targetDir, 'src', 'pages', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'layouts'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'components'), { recursive: true })
  mkdirSync(join(targetDir, 'content', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'public'), { recursive: true })
```

Replace with:

```ts
  mkdirSync(join(targetDir, 'src', 'pages', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'layouts'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'components'), { recursive: true })
  mkdirSync(join(targetDir, 'src', 'assets', 'css'), { recursive: true })
  mkdirSync(join(targetDir, 'content', 'blog'), { recursive: true })
  mkdirSync(join(targetDir, 'public'), { recursive: true })
```

Then add this `writeFileSync` call. Place it right after the directory-creation block above (before the `writeFileSync(... 'Layout.wald' ...)` call):

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "global.css"
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "Add global.css generation to the scaffold"
```

---

### Task 2: Generate the tree logo component

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Test: `packages/cli/src/commands/plant.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('creates src/components/TreeMark.wald with an inline SVG', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'components', 'TreeMark.wald'), 'utf8')
    expect(content).toContain('<svg')
    expect(content).toContain('#FF3347')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "TreeMark"
```

Expected: FAIL with `ENOENT`.

- [ ] **Step 3: Write minimal implementation**

Add this `writeFileSync` call in `plant.ts`, right after the `global.css` one from Task 1:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "TreeMark"
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "Add TreeMark logo component to the scaffold"
```

---

### Task 3: Rewrite Layout.wald with navbar, footer, and stylesheet links

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Test: `packages/cli/src/commands/plant.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test. It intentionally also re-checks the two assertions the existing `'creates src/layouts/Layout.wald with pond and full HTML shell'` test makes, since we're replacing that file's content:

```ts
  it('Layout.wald includes a navbar, footer, and the global stylesheet', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'layouts', 'Layout.wald'), 'utf8')
    expect(content).toContain('/assets/css/global.css')
    expect(content).toContain('fonts.googleapis.com')
    expect(content).toContain('TreeMark')
    expect(content).toContain('class="navbar"')
    expect(content).toContain('class="site-footer"')
    expect(content).toContain('pond')
    expect(content).toContain('<!DOCTYPE html>')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "navbar, footer"
```

Expected: FAIL — current `Layout.wald` has none of the navbar/footer/stylesheet content.

- [ ] **Step 3: Write minimal implementation**

In `plant.ts`, find the existing `Layout.wald` block:

```ts
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
```

Replace it with:

```ts
  writeFileSync(
    join(targetDir, 'src', 'layouts', 'Layout.wald'),
    [
      '---',
      "import TreeMark from '../components/TreeMark.wald'",
      'const { title, pond } = $$props',
      '---',
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <meta name="viewport" content="width=device-width" />',
      '    <title>{title}</title>',
      '    <link rel="preconnect" href="https://fonts.googleapis.com">',
      '    <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&display=swap" rel="stylesheet">',
      '    <link rel="stylesheet" href="/assets/css/global.css">',
      '  </head>',
      '  <body>',
      '    <nav class="navbar">',
      '      <a class="logo" href="/">',
      '        <TreeMark />',
      '        <span>my-forest</span>',
      '      </a>',
      '      <div class="navlinks">',
      '        <a href="/">Home</a>',
      '        <a href="/blog">Blog</a>',
      '      </div>',
      '    </nav>',
      '    {pond}',
      '    <footer class="site-footer">Built with WaldJS</footer>',
      '  </body>',
      '</html>',
      '',
    ].join('\n')
  )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts
```

Expected: all tests pass, including the pre-existing `'creates src/layouts/Layout.wald with pond and full HTML shell'` test (still satisfied — `pond` and `<!DOCTYPE html>` are both still present).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "Add navbar, footer, and stylesheet links to scaffolded Layout.wald"
```

---

### Task 4: Add an icon prop to Card.wald

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Test: `packages/cli/src/commands/plant.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('Card.wald accepts an icon prop', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'components', 'Card.wald'), 'utf8')
    expect(content).toContain('icon')
    expect(content).toContain('card-icon')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "icon prop"
```

Expected: FAIL — current `Card.wald` has no `icon` prop or `card-icon` element.

- [ ] **Step 3: Write minimal implementation**

Find the existing `Card.wald` block:

```ts
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
```

Replace it with:

```ts
  writeFileSync(
    join(targetDir, 'src', 'components', 'Card.wald'),
    [
      '---',
      'const { title, body, icon } = $$props',
      '---',
      '<article class="card">',
      '  <div class="card-icon">{icon}</div>',
      '  <h3>{title}</h3>',
      '  <p>{body}</p>',
      '</article>',
      '',
    ].join('\n')
  )
```

Note this also changes the heading from `<h2>` to `<h3>` (the page itself now provides the `<h1>`/section heading, so `Card`'s own heading drops a level) and adds the `class="card"` the new stylesheet targets.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts
```

Expected: all tests pass, including the pre-existing `'creates src/components/Card.wald with $$props'` test (`$$props` is still present).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "Add icon prop and card styling classes to scaffolded Card.wald"
```

---

### Task 5: Rewrite index.wald as a hero + feature row + counter demo

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Test: `packages/cli/src/commands/plant.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('index.wald has a hero, three feature cards, and the counter demo', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'pages', 'index.wald'), 'utf8')
    expect(content).toContain('class="hero"')
    expect(content).toContain('class="features"')
    expect(content).toContain('class="counter-demo"')
    expect((content.match(/<Card/g) ?? []).length).toBe(3)
    expect(content).toContain('<Counter')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "hero, three feature cards"
```

Expected: FAIL — current `index.wald` has one `Card` and no hero/features/counter-demo sections.

- [ ] **Step 3: Write minimal implementation**

Find the existing `index.wald` block:

```ts
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
```

Replace it with:

```ts
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
      '  <section class="hero">',
      '    <p class="eyebrow">Gebouwd met WaldJS</p>',
      '    <h1>Plant je site.<br>Laat hem groeien.</h1>',
      '    <p class="hero-sub">Dit is je eerste WaldJS-pagina — pas \'m aan in src/pages/index.wald</p>',
      '    <a class="btn" href="/blog">Bekijk de blog</a>',
      '  </section>',
      '  <section class="features">',
      '    <Card icon="⚡" title="0 KB JS" body="Statisch by default" />',
      '    <Card icon="📄" title="Content" body="Blog uit /content" />',
      '    <Card icon="🌱" title="Interactief" body="Islands als nodig" />',
      '  </section>',
      '  <section class="counter-demo">',
      '    <p>Probeer de counter</p>',
      '    <Counter initial={3} />',
      '  </section>',
      '</Layout>',
      '',
    ].join('\n')
  )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts
```

Expected: all tests pass, including the pre-existing `'creates src/pages/index.wald with starter content'` test (`const title` and `<Layout` are both still present).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "Redesign scaffolded index.wald with hero, feature row, and counter demo"
```

---

### Task 6: Rewrite blog/index.wald with a styled post list

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Test: `packages/cli/src/commands/plant.test.ts`

WaldJS templates cannot embed a component tag (e.g. `<Card />`) inside a `.map()` callback — there is no JSX transform for that. The supported pattern (see `marketing/src/components/Features.wald`) is building an HTML string directly and interpolating it as a single expression.

- [ ] **Step 1: Write the failing test**

```ts
  it('blog/index.wald has a page header and a styled post list', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'pages', 'blog', 'index.wald'), 'utf8')
    expect(content).toContain('class="page-header"')
    expect(content).toContain('class="post-list"')
    expect(content).toContain('class="post"')
    expect(content).toContain('.map(')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "page header and a styled post list"
```

Expected: FAIL — current `blog/index.wald` has none of these classes.

- [ ] **Step 3: Write minimal implementation**

Find the existing `blog/index.wald` block:

```ts
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
```

Replace it with:

```ts
  writeFileSync(
    join(targetDir, 'src', 'pages', 'blog', 'index.wald'),
    [
      '---',
      "import Layout from '../../layouts/Layout.wald'",
      "import { getCollection } from 'wald:content'",
      "const posts = await getCollection('blog')",
      "const count = posts.length",
      "const postList = posts.map(p => '<a class=\"post\" href=\"/blog/' + p.slug + '\"><h3>' + p.data.title + '</h3></a>').join('')",
      '---',
      '<Layout title="Blog">',
      '  <section class="page-header">',
      '    <h1>Blog</h1>',
      '    <p>{count} posts</p>',
      '  </section>',
      '  <section class="post-list">',
      '    {postList}',
      '  </section>',
      '</Layout>',
      '',
    ].join('\n')
  )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "Redesign scaffolded blog index with a styled post list"
```

---

### Task 7: Wrap blog/[slug].wald's content in a readable post-body layout

**Files:**
- Modify: `packages/cli/src/commands/plant.ts`
- Test: `packages/cli/src/commands/plant.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('blog/[slug].wald wraps content in a post-body article', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)
    const content = readFileSync(join(dir, 'src', 'pages', 'blog', '[slug].wald'), 'utf8')
    expect(content).toContain('class="post-body"')
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "post-body article"
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Find the existing `blog/[slug].wald` block:

```ts
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
```

Replace it with:

```ts
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
      '  <article class="post-body">',
      '    <h1>{post.data.title}</h1>',
      '    {post.body}',
      '  </article>',
      '</Layout>',
      '',
    ].join('\n')
  )
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts
```

Expected: all tests pass (should be 13 tests total now: the original 8 plus the 5 added in Tasks 1–4 and 6–7 — actually count as you go; the point is zero failures).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.ts packages/cli/src/commands/plant.test.ts
git commit -m "Wrap scaffolded blog post content in a readable post-body layout"
```

---

### Task 8: Add an end-to-end test that actually builds the scaffolded project

**Files:**
- Modify: `packages/cli/src/commands/plant.test.ts`

Every task above tests generated *source* content. None of them prove the scaffold actually compiles and builds — the same gap that let a real crash and a real broken-route bug reach npm earlier in this project's history (see the `.changeset` history / CHANGELOG for `@waldjs/cli` if you want the full story). This task closes that gap by running the real, built `wald` CLI as a subprocess against a freshly scaffolded project, the same way `marketing/src/smoke.test.ts` verifies the marketing site's own build.

- [ ] **Step 1: Write the failing test**

Add this import to the top of `packages/cli/src/commands/plant.test.ts` (alongside the existing imports):

```ts
import { execFileSync } from 'node:child_process'
```

Then add this test inside the `describe('scaffold', ...)` block:

```ts
  it('scaffolds a project that builds successfully with the real wald CLI', async () => {
    const base = mkdtempSync(join(tmpdir(), 'wald-plant-e2e-'))
    const dir = join(base, 'my-forest')
    await scaffold(dir)

    const cliBin = join(__dirname, '..', '..', 'bin', 'wald.js')
    execFileSync(process.execPath, [cliBin, 'build'], { cwd: dir, stdio: 'pipe' })

    const html = readFileSync(join(dir, 'dist', 'index.html'), 'utf8')
    expect(html).toContain('/assets/css/global.css')
    expect(html).toContain('class="hero"')

    expect(existsSync(join(dir, 'dist', 'assets', 'css', 'global.css'))).toBe(true)
    expect(existsSync(join(dir, 'dist', 'blog', 'hello-world', 'index.html'))).toBe(true)
  }, 60_000)
```

Note the `60_000` (60 second) timeout — this spawns a real Vite SSR build in a subprocess, which is slower than the rest of the mocked-Vite test suite.

- [ ] **Step 2: Run test to verify it fails or passes for the right reason**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts -t "builds successfully with the real wald CLI"
```

If Tasks 1–7 were done correctly, this should already PASS — it's a regression guard for the redesign you just built, not a new feature. If it fails, read the error: it will point at exactly the kind of wiring mistake (wrong asset path, broken import, invalid template syntax) that the source-content tests in Tasks 1–7 can't catch.

- [ ] **Step 3: If it failed, fix the root cause**

Do not weaken the test's assertions to make it pass. If it fails, something in Tasks 1–7's generated output is actually broken — go back and fix the relevant `writeFileSync` block in `plant.ts`.

- [ ] **Step 4: Run the full plant.test.ts suite**

```bash
cd packages/cli && npx vitest run src/commands/plant.test.ts
```

Expected: all tests pass, zero failures.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/plant.test.ts
git commit -m "Add end-to-end test that builds a freshly scaffolded project"
```

---

### Task 9: Full monorepo verification, changeset, and manual visual check

**Files:**
- Create: `.changeset/redesign-scaffold-starter.md`

- [ ] **Step 1: Run the full CLI test suite**

```bash
cd packages/cli && npx vitest run
```

Expected: all test files pass (was 12 files / 101 tests before this plan; expect the same files plus the new assertions in `plant.test.ts`, all green).

- [ ] **Step 2: Run the full monorepo build and test**

From the repo root:

```bash
pnpm build && pnpm test
```

Expected: every package's build and test task succeeds, including `@waldjs/marketing` (unaffected by this change, but must stay green) and `@waldjs/basic-example`.

- [ ] **Step 3: Manually scaffold a fresh project and look at it**

This is the actual point of the whole plan — confirm it looks good, not just that assertions pass.

```bash
cd /tmp && rm -rf scaffold-visual-check && mkdir scaffold-visual-check && cd scaffold-visual-check
node <path-to-repo>/packages/cli/bin/wald.js plant my-forest
cd my-forest
node <path-to-repo>/packages/cli/bin/wald.js grow
```

Open `http://localhost:7233` in a browser. Check:
- Dark green gradient background, not flat color or white
- Baloo 2 font loaded (not a fallback serif/system font — check DevTools' Network tab for the Google Fonts request, or the Computed styles panel)
- Hero heading wraps tightly (not loose default line-height)
- The 3 feature cards and the CTA button have visible depth (gradient + shadow), not flat fills
- Clicking the counter's `+` button increments the number
- `/blog` shows the styled post list; clicking through to the post renders the post-body layout
- The navbar logo shows the SVG tree mark, not a broken image icon

Fix anything that looks wrong before continuing — this is a design feature, and "the tests pass" is not the definition of done here.

- [ ] **Step 4: Add a changeset**

Create `.changeset/redesign-scaffold-starter.md` with this exact content:

```markdown
---
"@waldjs/cli": minor
---

`wald plant` (and `create-wald`) now scaffold a fully styled starter instead of unstyled HTML: a dark green gradient background, glossy red 3D buttons and cards, Baloo 2 typography, a navbar/footer, and a styled blog list — matching WaldJS's own brand. `Card` gained an optional `icon` prop; `Counter`'s behavior is unchanged, only restyled.
```

- [ ] **Step 5: Commit**

```bash
git add .changeset/redesign-scaffold-starter.md
git commit -m "Add changeset for scaffold starter redesign"
```

---

## Summary

After all 9 tasks: `wald plant` / `npm create wald@latest` produces a project that looks like a real, branded landing page on first `wald grow` — hero, feature showcase, live counter demo, styled blog — instead of unstyled HTML. The new end-to-end test (Task 8) means a future change to routing, asset paths, or the compiler that breaks this silently will fail CI instead of shipping unnoticed, the same way the `/assets` vs `/styles` mistake was caught during planning instead of after a fourth publish-and-discover cycle.
