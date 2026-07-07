const GREEN = '\x1b[32m'
const TRUNK_COLOR = '\x1b[33m'
const DIM = '\x1b[2m'
const STAR_COLOR = '\x1b[2;37m'
const MOON_COLOR = '\x1b[97m'
const RESET = '\x1b[0m'
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'
const CLEAR_LINE = '\x1b[2K'
const DEER_COLOR = '\x1b[97m'

const CANVAS_WIDTH = 70
const CENTER_COL = 35
const MAX_TIERS = 5

const SIDE_TREES = [
  { col: 26, revealAt: 2, tiers: 2 },
  { col: 44, revealAt: 2, tiers: 2 },
  { col: 17, revealAt: 4, tiers: 3 },
  { col: 53, revealAt: 4, tiers: 3 },
]

const CANOPY_ROWS = MAX_TIERS
const TOTAL_LINES = CANOPY_ROWS + 15
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const FRAME_MS = 140
const MIN_VISIBLE_MS = FRAME_MS * (MAX_TIERS + 6)

const STORY_BEATS = [
  'Planting a seed…',
  'Roots taking hold…',
  'A sapling reaches up…',
  'Branches spreading wide…',
  'The forest is waking up…',
]

const STARS = [
  { row: 0, col: 1 },
  { row: 0, col: 6 },
  { row: 0, col: 26 },
  { row: 1, col: 8 },
  { row: 1, col: 25 },
]
const MOON = { row: 0, col: 68 }

type Cell = { ch: string; color: string }

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function blankRow(bg: string): Cell[] {
  return Array.from({ length: CANVAS_WIDTH }, () => ({ ch: bg, color: '' }))
}

function stamp(row: Cell[], centerCol: number, text: string, color: string) {
  const startCol = centerCol - Math.floor(text.length / 2)
  for (let i = 0; i < text.length; i++) {
    const col = startCol + i
    if (col >= 0 && col < CANVAS_WIDTH) row[col] = { ch: text[i], color }
  }
}

function rowToString(row: Cell[]) {
  return row.map(c => (c.color ? c.color + c.ch + RESET : c.ch)).join('')
}

function stampTree(rows: Cell[][], col: number, totalTiers: number, grownTiers: number) {
  for (let t = 1; t <= grownTiers; t++) {
    const row = CANOPY_ROWS - 1 - totalTiers + t
    if (row >= 0 && row < CANOPY_ROWS) stamp(rows[row], col, '*'.repeat(t * 2 - 1), GREEN)
  }
}

function buildCanopy(tier: number) {
  const rows = Array.from({ length: CANOPY_ROWS }, () => blankRow(' '))

  stampTree(rows, CENTER_COL, tier, tier)
  for (const side of SIDE_TREES) {
    if (tier >= side.revealAt) stampTree(rows, side.col, side.tiers, side.tiers)
  }

  for (const star of STARS) {
    if (rows[star.row][star.col].ch === ' ') rows[star.row][star.col] = { ch: '.', color: STAR_COLOR }
  }
  if (rows[MOON.row][MOON.col].ch === ' ') rows[MOON.row][MOON.col] = { ch: 'O', color: MOON_COLOR }

  return rows
}

function trunkRow(tier: number) {
  const row = blankRow(' ')
  stamp(row, CENTER_COL, '|', TRUNK_COLOR)
  for (const side of SIDE_TREES) {
    if (tier >= side.revealAt) stamp(row, side.col, '|', TRUNK_COLOR)
  }
  return row
}

const DEER_FRAMES = [
  [
    '  ,_)/',
    "   (-'",
    " .-'\\\\ ",
    "  \"'\\\\'\"\"\"\"\"'),",
    '     )/---,(',
    '    / \\\\  / |',
  ],
  [
    '  ,_)/',
    "   (-'",
    " .-'\\\\ ",
    "  \"'\\\\'\"\"\"\"\"'),",
    '     )/---,(',
    '     \\\\ /  \\\\|',
  ],
]

const DEER_WIDTH = Math.max(...DEER_FRAMES.flat().map(row => row.length))
const DEER_TARGET_COL = CENTER_COL - Math.floor(DEER_WIDTH / 2)
const DEER_STEP_COLS = 3

function deerColForTick(tick: number) {
  return Math.max(DEER_TARGET_COL, CANVAS_WIDTH - tick * DEER_STEP_COLS)
}

function deerRows(leftCol: number, tick: number) {
  const isWalking = leftCol > DEER_TARGET_COL
  const sprites = isWalking ? DEER_FRAMES[tick % DEER_FRAMES.length] : DEER_FRAMES[0]

  return sprites.map(sprite => {
    const row = blankRow(' ')
    for (let i = 0; i < sprite.length; i++) {
      const col = leftCol + i
      if (col >= 0 && col < CANVAS_WIDTH) row[col] = { ch: sprite[i], color: DEER_COLOR }
    }
    return row
  })
}

const WALD_MARK_ROWS = [
  '░██       ░██            ░██        ░██     ░█████   ░██████   ',
  '░██       ░██            ░██        ░██       ░██   ░██   ░██  ',
  '░██  ░██  ░██  ░██████   ░██  ░████████       ░██  ░██         ',
  '░██ ░████ ░██       ░██  ░██ ░██    ░██       ░██   ░████████  ',
  '░██░██ ░██░██  ░███████  ░██ ░██    ░██ ░██   ░██          ░██ ',
  '░████   ░████ ░██   ░██  ░██ ░██   ░███ ░██   ░██   ░██   ░██  ',
  '░███     ░███  ░█████░██ ░██  ░█████░██  ░██████     ░██████  ',
]

function waldMarkRows() {
  return WALD_MARK_ROWS.map(sprite => {
    const row = blankRow(' ')
    stamp(row, CENTER_COL, sprite, DIM)
    return row
  })
}

export async function withGrowingTree<T>(label: string, task: Promise<T>): Promise<T> {
  if (!process.stdout.isTTY) {
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
    for (const row of deerRows(deerColForTick(tick), tick)) process.stdout.write(CLEAR_LINE + rowToString(row) + '\n')
    for (const row of waldMarkRows()) process.stdout.write(CLEAR_LINE + rowToString(row) + '\n')

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
    for (const row of deerRows(deerColForTick(tick), tick)) process.stdout.write(CLEAR_LINE + rowToString(row) + '\n')
    for (const row of waldMarkRows()) process.stdout.write(CLEAR_LINE + rowToString(row) + '\n')
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
