import { defineCommand, runMain } from 'citty'
import { plantCommand } from './commands/plant.js'
import { growCommand } from './commands/grow.js'
import { buildCommand } from './commands/build.js'
import { previewCommand } from './commands/preview.js'
import { checkCommand } from './commands/check.js'

const main = defineCommand({
  meta: {
    name: 'wald',
    version: '0.1.0',
    description: 'WaldJS — a content-first web framework',
  },
  subCommands: {
    plant: plantCommand,
    grow: growCommand,
    build: buildCommand,
    preview: previewCommand,
    check: checkCommand,
  },
})

runMain(main)
