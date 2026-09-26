# Semantic HTML Excellence — Design

## Motivation

Sub-project 2 of 3 in a broader accessibility/semantics/i18n-naming effort
(sub-project 1, reduced-motion + high-contrast media queries, is merged —
PR #72). A manual audit against the live site (not just the earlier
Lighthouse report, which turned out to have at least one unreproducible
finding) surfaced six concrete, verified gaps. Scope confirmed as "all of
them" — this is meant to bring the site to a genuinely modern (2026)
semantic/accessibility baseline, not just patch the cheapest wins.

## Verified findings (checked against actual source/live HTML, not assumed)

1. **Heading-order skips on 3 of 6 page types**, confirmed via `curl` against
   both the local build and the live site:
   - `/waarom`: h1 → h2×4 → h4 (skips h3 — Footer's `<h4>` columns follow
     directly with nothing in between).
   - `/changelog` (list): h1 → h3×8 (skips h2 — each changelog card title
     is an `<h3>` with no `<h2>` anywhere on the page).
   - `/changelog/[slug]` (detail): h1 → h4 (skips h2 and h3 — an entry has
     only its own title as a heading before Footer).
   - `/`, `/vs/astro`, `/vs/eleventy` are already valid.
2. **No `<main>` landmark anywhere.** Confirmed via `curl -s
   https://waldjs.eu/ | grep -o '<main[^>]*>\|role="main"'` — zero matches.
   `Layout.wald` inserts `{pond}` directly between `<Nav />` and `<Footer
   />` with no wrapping landmark.
3. **Comparison table headers lack `scope="col"`.** `Vergelijking.wald`'s
   `<tr><th>Feature</th><th>WaldJS</th><th>Astro</th><th>Eleventy</th></tr>`
   has no `scope` attribute on any header cell.
4. **Mobile menu isn't a real dialog.** `#mobielmenu` (`Nav.wald`) has no
   `role="dialog"`/`aria-modal`. `toggleMenu()` (`site.js`) only toggles a
   CSS class and `aria-hidden` — it doesn't move focus into the menu on
   open, doesn't trap Tab/Shift+Tab within it, doesn't close on Escape, and
   doesn't restore focus to the hamburger button on close. A keyboard user
   who opens it can Tab straight through to the (visually hidden but still
   focusable) page content behind it.
5. **No `aria-current="page"`** anywhere in the codebase (confirmed via
   grep). `Nav.wald` doesn't currently receive `canonicalPath` as a prop at
   all (unlike `Footer.wald`, which already does, from the `/waarom`
   self-link-suppression work in PR #64).
6. **No skip-to-content link.**

## Approach

### 1. Heading order — two targeted structural fixes, not per-page hacks

Rather than patching each page's specific skip individually (fragile —
a future page could reintroduce the same bug), fix the two shared pieces
that every page's heading sequence funnels through:

- `Footer.wald`: both `<h4>Verken/Explore</h4>` and
  `<h4>Bronnen/Resources</h4>` become `<h2>`. CSS selector
  `.footer-grid h4` (`28-footer.css`) becomes `.footer-grid h2`.
- `changelog/index.wald`: the per-entry card title, currently generated as
  `<h3><a href="/changelog/${entry.slug}">${entry.data.title}</a></h3>`
  inside the `SafeHtml` template-string block, becomes `<h2>`. CSS
  selectors in `27-changelog-groeidagboek.css` (`.log-kop h3`, `.log-kop h3
  a`, `.log-kop h3 a:visited`, `.log-kop h3 a:hover`, `.log-kop h3
  a:focus-visible`) all become `.log-kop h2` / `.log-kop h2 a` / etc.

Hand-traced against all 6 page types with these two changes applied, every
sequence is now fully monotonic (no increase greater than +1 anywhere):

| Page | New sequence |
|---|---|
| `/` (homepage) | h1 → h2×N → h3×N (various sections) → h3×3 (3 recent changelog cards) → **h2** (footer) — valid, decreases are always fine |
| `/waarom` | h1 → h2×4 → **h2** (footer) — same level, valid |
| `/vs/astro`, `/vs/eleventy` | h1 → h2 → h3 → h3 → **h2** (footer) — valid |
| `/changelog` (list) | h1 → **h2**×8 (cards) → **h2** (footer) — valid |
| `/changelog/[slug]` (detail) | h1 → **h2** (footer) — valid, +1 step |

No other page type exists in the site today, so this fully resolves the
issue everywhere with two small, targeted changes instead of six.

### 2. `<main>` landmark

`Layout.wald`: `{pond}` becomes `<main id="main">{pond}</main>`. Verified
safe — no CSS in the codebase uses a `body >`, `nav +`, or `nav ~`
selector that assumes the current flat sibling structure (checked via
grep across all 29 style partials).

### 3. Table header scope

`Vergelijking.wald`: each `<th>` in the header row gets `scope="col"` —
`<th scope="col">Feature</th>`, etc.

### 4. Mobile menu: dialog semantics + focus trap

`Nav.wald`: `#mobielmenu` gets `role="dialog"` `aria-modal="true"`
`aria-label="Menu"`. (Note: this label stays static/untranslated, matching
the existing — imperfect but pre-existing — convention already used for
`aria-label="Sluit menu"` on the close button, which is Dutch-only today
regardless of the active language toggle. Not introducing a new i18n gap,
just not fixing an existing unrelated one as a drive-by in this sub-project.)

`site.js`'s `toggleMenu(open)` gains:
- **On open:** save `document.activeElement` (to restore later), move
  focus to the close button (`.sluit`), and attach a `keydown` listener
  that (a) closes the menu on `Escape`, restoring focus, and (b) traps
  `Tab`/`Shift+Tab` cycling between the menu's focusable elements (the
  close button and each link) so focus can't escape to the page behind it
  while the overlay is visible.
- **On close:** remove the `keydown` listener, restore focus to the
  previously-saved element (the hamburger button, in practice).

### 5. `aria-current="page"`

Only applied to the nav's two genuine distinct-page links (`/changelog`,
`/waarom`) — not the homepage section anchors (`/#quickstart` etc.), since
`aria-current="page"` is a "which document is this" signal, not meant for
in-page anchors.

`Layout.wald` passes `canonicalPath={canonicalPath}` to `<Nav />` (same
pattern already used for `<Footer canonicalPath={canonicalPath} />`).
`Nav.wald` destructures it from `$$props` and conditionally renders
`aria-current="page"` on the `/changelog` and `/waarom` `<li><a>` elements
(both the desktop list and the mobile menu's matching links) when
`canonicalPath` equals that link's href.

### 6. Skip-to-content link

`Layout.wald`: a new first-focusable element right after `<body>` opens
(before the decorative canvas/divs), linking to `#main` (the new `<main>`
id from point 2):

```html
<a class="skip-link" href="#main"><span class="nl">Ga naar inhoud</span><span class="en">Skip to content</span></a>
```

New CSS (in `01-base.css`, alongside the other base-layer rules): visually
hidden by default (off-screen, not `display:none` — must stay in the
accessibility tree and focusable), revealed on `:focus` by moving back
on-screen above the fixed nav (`z-index` above `nav`'s `--byz-z-sticky`).

## Testing

- Extend `marketing/src/smoke.test.ts`:
  - `dist/index.html` (and one non-homepage page) contains exactly one
    `<main id="main">`.
  - The comparison pages' `<th>` cells all contain `scope="col"`.
  - `dist/changelog/index.html`'s card titles are `<h2>`, not `<h3>`.
  - `dist/waarom/index.html` and `dist/changelog/roots/index.html` (or
    similar) contain no heading-level jump greater than 1 — this needs a
    small helper function that extracts `<h[1-6]>` tags in document order
    from the built HTML and asserts no consecutive pair increases by more
    than 1. Write this once, reuse it per page.
  - `dist/changelog/index.html` contains `aria-current="page"` on the
    `/changelog` nav link; `dist/index.html` does NOT contain
    `aria-current="page"` anywhere (no page matches on the homepage, since
    homepage links are all anchors).
  - `dist/index.html` contains a `.skip-link` anchor targeting `#main`.
- Manual verification: build, then grep the built HTML for each change,
  same pattern used throughout this session for CSS/HTML-only fixes.
- Focus-trap/Escape/focus-restore behavior (point 4) is JS timing/DOM-event
  behavior, not just static markup — per this session's established
  lesson from the earlier scroll-race-condition bug, this needs a real
  browser check (headless Chrome via `puppeteer-core`, not just a unit
  test), not just trusting the code reads correctly. Manually verify: open
  menu → focus lands on close button → Tab cycles only within the menu →
  Escape closes and restores focus to the hamburger button.

## Non-goals

- Not fixing the pre-existing Dutch-only `aria-label="Sluit menu"` (and
  similarly the new dialog's static `aria-label="Menu"`) — that's a
  separate, smaller i18n-for-ARIA gap, not introduced by this sub-project.
- Not adding `aria-current` to the homepage's in-page section anchors —
  not the correct use of the attribute.
- Sub-project 3 (Dutch→English CSS class renaming) is explicitly separate
  and comes after this one, per the earlier 3-part decomposition.
