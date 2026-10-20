import { defineCommand, runMain } from 'citty'
import { WALD_VERSION } from './version.js'

const main = defineCommand({
  meta: {
    name: 'wald',
    version: WALD_VERSION,
    description: 'WaldJS — a content-first web framework',
  },
  // Loaded on demand: each command pulls in its own heavy dependencies
  // (TypeScript alone takes ~300ms to import), so `wald build` shouldn't pay
  // for `wald check` and vice versa.
  subCommands: {
    plant: () => import('./commands/plant.js').then(m => m.plantCommand),
    grow: () => import('./commands/grow.js').then(m => m.growCommand),
    build: () => import('./commands/build.js').then(m => m.buildCommand),
    preview: () => import('./commands/preview.js').then(m => m.previewCommand),
    check: () => import('./commands/check.js').then(m => m.checkCommand),
    format: () => import('./commands/format.js').then(m => m.formatCommand),
    new: () => import('./commands/new.js').then(m => m.newCommand),
  },
})

runMain(main)
