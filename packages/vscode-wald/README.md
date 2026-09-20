# vscode-wald

Syntax highlighting for WaldJS `.wald` single-file components in VS Code.

A `.wald` file is TypeScript frontmatter between `---` delimiters, followed by an HTML template with `{expression}` islands:

```wald
---
type Props = { title: string }
const { title } = $props
---
<Card label="hello">
  <h1>{title.toUpperCase()}</h1>
</Card>
```

This extension contributes:

- A `wald` language definition for `*.wald` files with bracket matching, auto-closing pairs, and `<!-- -->` comment toggling.
- A TextMate grammar (`source.wald`) that highlights:
  - the frontmatter as embedded TypeScript (`source.ts`),
  - the template as HTML (`text.html.basic`),
  - `{expr}` interpolations — in text and in attribute position, with nested braces like `data={{ nested: true }}` — as embedded TypeScript with distinctly scoped braces,
  - component tags (`<Card />`, anything starting with an uppercase letter) as component/class names rather than plain HTML tags.

## Status: not published

This extension is **not yet on the VS Code Marketplace** (tracked in [#33](https://github.com/Stefan-Espant/WaldJS/issues/33)) — `package.json` is publish-ready (`private: false`, `repository`, `bugs`, `homepage`, `keywords`), but publishing itself needs a Marketplace publisher account, which only the maintainer can create. See **Publishing** below.

To use it locally in the meantime:

**Option A — package and install:**

```sh
cd packages/vscode-wald
npx @vscode/vsce package   # produces vscode-wald-0.0.1.vsix
code --install-extension vscode-wald-0.0.1.vsix
```

**Option B — symlink for local development:**

```sh
ln -s "$(pwd)/packages/vscode-wald" ~/.vscode/extensions/waldjs.vscode-wald-0.0.1
```

Then reload VS Code and open any `.wald` file. If your workspace's `.vscode/settings.json` still maps `*.wald` to HTML via `files.associations`, remove that entry so the `wald` language takes over.

## Publishing (for maintainers)

One-time setup, done outside this repo:

1. Create a Marketplace publisher at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage), with an id matching `publisher` in `package.json` (currently `waldjs`). This needs a Microsoft/Azure DevOps account.
2. Generate a Personal Access Token at [dev.azure.com](https://dev.azure.com) → User settings → Personal access tokens, scoped to **Marketplace (Manage)**. Treat it like any other secret — never commit it.
3. `npx vsce login waldjs` and paste the token when prompted (stores it locally, not in the repo).

To publish a release, from `packages/vscode-wald`:

```sh
npx vsce publish            # publishes the current version
npx vsce publish patch      # or bump patch/minor/major first, then publish
```

## Verification

The grammar is tokenizer-tested with `vscode-textmate` + `vscode-oniguruma` against VS Code's own TypeScript and HTML grammars (frontmatter tokens receive `source.ts` scopes, `{expr}` contents receive TS scopes inside `meta.embedded.expression.wald`, component tags receive `support.class.component.wald`). That harness lives outside the repo to avoid adding dependencies to the workspace; final visual confirmation should be done in a real VS Code window using one of the install options above.
