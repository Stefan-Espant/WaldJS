---
"@waldjs/cli": patch
---

Fix the scoped-component-CSS stylesheet link (`/assets/wald-components.css`) to respect `config.base` in both `wald build` output and `wald grow`'s dev-server route — previously hardcoded to the root path, it 404'd under a non-default `base` (e.g. a GitHub Pages project page). Also adds a regression test confirming a component using both `<style>` and `canopy:*` keeps its scope attribute.
