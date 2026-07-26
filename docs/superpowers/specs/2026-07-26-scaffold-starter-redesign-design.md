# Scaffold starter redesign

## Problem

`npm create wald@latest` / `wald plant` scaffolds a project with zero CSS. `Layout.wald` renders `{pond}` with no header, footer, or stylesheet; `Card.wald` and `Counter.wald` have classes but nothing styles them. The result is unstyled default-browser HTML — a poor first impression for a new user, and nothing to show off when demoing WaldJS to someone else.

## Goal

Make the scaffolded starter look like a polished, professional landing page on first run — while still subtly demonstrating WaldJS's core capabilities (zero-JS-by-default, content collections, islands) — without turning the scaffold into a copy of the marketing site's much heavier build (29 CSS partials, Typekit fonts, animation systems).

## Visual direction

- Borrows the WaldJS brand: dark green radial-gradient background (`#0A5240` → `#023B2D` → `#01271D`), red/pink glossy accent (`#FF5B6C` → `#FF3347` → `#D91A31`), white text.
- Typography: **Baloo 2** (Google Fonts, freely licensed) — not Puffin Display Soft/Grafolita Script, which are served through a Typekit kit tied to the marketing site's own domain and cannot legally or reliably be bundled into a redistributable npm package template.
- 3D depth language reused directly from the marketing site's existing CSS: glossy gradient buttons with layered inset/outset `box-shadow` (see `marketing/src/styles/partials/03-nav.css` `.btn`), and cards with soft layered shadows (see `10-kaarten.css` `.kaart`). Same recipe, ported into the scaffold's own stylesheet — not shared code, since the scaffold must stand alone in a user's project with no dependency on the marketing package.
- Tight line-height (`1.08`) on the hero heading — the default browser line-height reads too loose at large display sizes.
- Small inline SVG tree mark replaces the idea of using an emoji logo — renders identically across platforms, colored in the brand red.

Confirmed via visual mockups (3 layout directions shown, iterated to final: dark background + tight heading + full 3D/gradient treatment). See screenshots saved under `.superpowers/brainstorm/` for this session if still present locally (not committed — local brainstorming artifacts only).

## Page structure

All three scaffolded pages share the same chrome (navbar with logo + Home/Blog links, footer):

1. **Home** (`src/pages/index.wald`)
   - Hero: small uppercase eyebrow ("Gebouwd met WaldJS"), large heading, one-line subtext, one primary CTA button linking to the blog page.
   - Feature row: three `Card` instances (icon + short heading + one-line description) demonstrating: 0 KB JS by default, content collections, islands/interactivity.
   - Small counter demo (pill-shaped, using the existing `Counter` component) as a live, low-key proof of "interactive when you want it."

2. **Blog index** (`src/pages/blog/index.wald`)
   - Same navbar/footer chrome.
   - List of posts rendered as `Card` instances (same visual language as the home feature row), sourced from `getCollection('blog')` (unchanged from today's scaffold logic — only the presentation changes).

3. **Blog post** (`src/pages/blog/[slug].wald`)
   - Same chrome, quiet reading layout: title, date, body content. No card treatment here — this page is about readability, not showcasing.

## Technical approach

- **One stylesheet**: `src/styles/global.css`, written by `scaffold()` alongside the other generated files, linked from `Layout.wald`'s `<head>`. Not a partials system — a single file is the right amount of structure for a starter project someone is about to heavily edit.
- **Fonts**: a Google Fonts `<link>` for Baloo 2 in `Layout.wald`'s `<head>`, weights 500/700/800 (matches what the mockups used).
- **Logo**: new `src/components/TreeMark.wald` (or inlined directly in `Layout.wald` — implementation plan decides), a small SVG, no props needed.
- **`Card.wald`**: gains an optional `icon` prop (a short string/emoji is enough — no icon library) rendered above the title. Existing `title`/`body` props unchanged, so it stays a single reusable component for both the home feature row and the blog list. WaldJS has no component-scoped CSS mechanism (confirmed: no `<style>`/scoping support in the compiler) — styling is plain global classes, same as the marketing site's own approach, so `global.css` targeting `.card` etc. works directly with no extra plumbing.
- **`Counter.wald`**: behavior untouched (the existing vanilla-JS click handler already works and is explicitly the "here's an interactive island" demo) — only gets the pill visual treatment via new CSS classes.
- **`Layout.wald`**: gains a real navbar (logo + nav links to `/` and `/blog`) and a minimal footer ("Built with WaldJS", no links needed beyond that — this is the user's project, not ours). Currently it only renders `{pond}` with no chrome at all.

## Out of scope

- No animation/motion system (marketing site has scroll-based effects, cursor trail, day/night toggle — none of that belongs in a lightweight starter).
- No dark/light theme toggle — single dark theme only, matching the brand.
- No changes to `Counter`'s or the content-collection logic's actual behavior, only presentation.
- No canopy/island usage in the starter by default — `Counter` stays a plain component for now; wiring it up as a canopy island is a separate, bigger decision (SSR vs hydration) not asked for here.
