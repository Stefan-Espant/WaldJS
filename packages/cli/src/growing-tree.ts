const GREEN = '\x1b[32m'
const TRUNK_COLOR = '\x1b[33m'
const DIM = '\x1b[2m'
const STAR_COLOR = '\x1b[2;37m'
const MOON_COLOR = '\x1b[97m'
const RESET = '\x1b[0m'
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'
const CLEAR_LINE = '\x1b[2K'
const OWL_COLOR = '\x1b[97m'

const CANVAS_WIDTH = 34
const CENTER_COL = 17
const MAX_TIERS = 5
const SIDE_TREE_TIERS = 2
// Two side trees reveal early, two further out fill in a little later —
// the forest thickens in waves instead of popping in all at once.
const SIDE_TREES = [
  { col: 11, revealAt: 2 },
  { col: 23, revealAt: 2 },
  { col: 4, revealAt: 4 },
  { col: 30, revealAt: 4 },
]
const CANOPY_ROWS = MAX_TIERS
// canopy rows + trunk row + 4 owl rows + status line
const TOTAL_LINES = CANOPY_ROWS + 6

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const FRAME_MS = 140
// Real builds often finish in well under a second — without a floor, the
// forest barely gets a moment to fill in before the animation is torn down.
const MIN_VISIBLE_MS = FRAME_MS * (MAX_TIERS + 6)

const STORY_BEATS = [
  'Planting a seed…',
  'Roots taking hold…',
  'A sapling reaches up…',
  'Branches spreading wide…',
  'The forest is waking up…',
]

// Fixed background dressing — same every frame, only the trees and the
// owl's eyes animate. Positions all sit in row 0, clear of every tree's
// widest possible tier.
const STARS: Array<{ row: number; col: number }> = [
  { row: 0, col: 1 },
  { row: 0, col: 6 },
  { row: 0, col: 26 },
  { row: 1, col: 8 },
  { row: 1, col: 25 },
]
const MOON = { row: 0, col: 32 }

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type Cell = { ch: string; color: string }

function blankRow(bg: string): Cell[] {
  return Array.from({ length: CANVAS_WIDTH }, () => ({ ch: bg, color: '' }))
}

function stamp(row: Cell[], centerCol: number, text: string, color: string): void {
  const startCol = centerCol - Math.floor(text.length / 2)
  for (let i = 0; i < text.length; i++) {
    const col = startCol + i
    if (col >= 0 && col < CANVAS_WIDTH) row[col] = { ch: text[i], color }
  }
}

function rowToString(row: Cell[]): string {
  return row.map(c => (c.color ? c.color + c.ch + RESET : c.ch)).join('')
}

// A tree's tiers are bottom-anchored: its widest, most-recently-grown tier
// always sits right above the trunk, and each earlier (narrower) tier sits
// one row higher — so the base never moves as the tree grows taller.
function stampTree(rows: Cell[][], col: number, totalTiers: number, grownTiers: number): void {
  for (let t = 1; t <= grownTiers; t++) {
    const row = CANOPY_ROWS - 1 - totalTiers + t
    if (row >= 0 && row < CANOPY_ROWS) stamp(rows[row], col, '*'.repeat(t * 2 - 1), GREEN)
  }
}

function buildCanopy(tier: number): Cell[][] {
  const rows = Array.from({ length: CANOPY_ROWS }, () => blankRow(' '))
  stampTree(rows, CENTER_COL, tier, tier)
  for (const side of SIDE_TREES) {
    if (tier >= side.revealAt) stampTree(rows, side.col, SIDE_TREE_TIERS, SIDE_TREE_TIERS)
  }
  for (const star of STARS) {
    if (rows[star.row][star.col].ch === ' ') rows[star.row][star.col] = { ch: '.', color: STAR_COLOR }
  }
  if (rows[MOON.row][MOON.col].ch === ' ') rows[MOON.row][MOON.col] = { ch: 'O', color: MOON_COLOR }
  return rows
}

function trunkRow(tier: number): Cell[] {
  const row = blankRow(' ')
  stamp(row, CENTER_COL, '|', TRUNK_COLOR)
  for (const side of SIDE_TREES) {
    if (tier >= side.revealAt) stamp(row, side.col, '|', TRUNK_COLOR)
  }
  return row
}

// A small ASCII owl that stays put and blinks occasionally — no jumping,
// no walking. Left-aligned per row (the art's own spacing makes the
// silhouette read correctly, so it isn't re-centered).
const OWL_ROW1 = ' /\\ /\\'
const OWL_EYES_OPEN = '((ovo))'
const OWL_EYES_SHUT = '((-v-))'
const OWL_ROW3 = '():::()'
const OWL_ROW4 = '  VVV'
const OWL_COL = CENTER_COL - Math.floor(OWL_EYES_OPEN.length / 2)
const BLINK_EVERY_N_TICKS = 11 // roughly once every ~1.5s at FRAME_MS=140

function owlRows(blinking: boolean): Cell[][] {
  const sprites = [OWL_ROW1, blinking ? OWL_EYES_SHUT : OWL_EYES_OPEN, OWL_ROW3, OWL_ROW4]
  return sprites.map(sprite => {
    const row = blankRow(' ')
    for (let i = 0; i < sprite.length; i++) {
      const col = OWL_COL + i
      if (col >= 0 && col < CANVAS_WIDTH) row[col] = { ch: sprite[i], color: OWL_COLOR }
    }
    return row
  })
}

/**
 * Renders a tiny forest scene growing in the terminal while `task` runs —
 * a main pine grows tier by tier, smaller pines fill in around it in
 * waves, and a small owl watches from its perch, blinking now and then.
 * Falls back to a plain label (no animation) when stdout isn't a TTY
 * (CI, piped output) so logs stay clean and non-garbled.
 */
export async function withGrowingTree<T>(label: string, task: Promise<T>): Promise<T> {
  if (!process.stdout.isTTY) {
    console.log(label)
    return task
  }

  let tier = 1
  let spinnerIdx = 0
  let tick = 0

  process.stdout.write(HIDE_CURSOR)
  process.stdout.write('\n'.repeat(TOTAL_LINES))

  const draw = () => {
    process.stdout.write(`\x1b[${TOTAL_LINES}A`)
    for (const row of buildCanopy(tier)) process.stdout.write(CLEAR_LINE + rowToString(row) + '\n')
    process.stdout.write(CLEAR_LINE + rowToString(trunkRow(tier)) + '\n')
    const blinking = tick % BLINK_EVERY_N_TICKS === 0
    for (const row of owlRows(blinking)) process.stdout.write(CLEAR_LINE + rowToString(row) + '\n')
    const story = STORY_BEATS[Math.min(tier, STORY_BEATS.length) - 1]
    const spinner = tier >= MAX_TIERS ? `${SPINNER_FRAMES[spinnerIdx]} ` : ''
    process.stdout.write(CLEAR_LINE + DIM + spinner + story + ` (${label})` + RESET + '\n')
  }

  draw()
  const interval = setInterval(() => {
    if (tier < MAX_TIERS) tier++
    tick++
    spinnerIdx = (spinnerIdx + 1) % SPINNER_FRAMES.length
    draw()
  }, FRAME_MS)

  const finish = () => {
    clearInterval(interval)
    process.stdout.write(`\x1b[${TOTAL_LINES}A`)
    for (const row of buildCanopy(MAX_TIERS)) process.stdout.write(CLEAR_LINE + rowToString(row) + '\n')
    process.stdout.write(CLEAR_LINE + rowToString(trunkRow(MAX_TIERS)) + '\n')
    for (const row of owlRows(false)) process.stdout.write(CLEAR_LINE + rowToString(row) + '\n')
    process.stdout.write(CLEAR_LINE + '\n')
    process.stdout.write(SHOW_CURSOR)
  }

  const started = Date.now()
  try {
    const result = await task
    const elapsed = Date.now() - started
    if (elapsed < MIN_VISIBLE_MS) await sleep(MIN_VISIBLE_MS - elapsed)
    finish()
    return result
  } catch (e) {
    const elapsed = Date.now() - started
    if (elapsed < MIN_VISIBLE_MS) await sleep(MIN_VISIBLE_MS - elapsed)
    finish()
    throw e
  }
}
