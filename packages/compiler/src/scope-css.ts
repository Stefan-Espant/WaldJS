import { createHash } from 'node:crypto'

/** Deterministic per component file, not per style content — the same
 * component always gets the same scope id, regardless of CSS edits. */
export function scopeHash(fileId: string): string {
  return createHash('sha256').update(fileId).digest('hex').slice(0, 8)
}

// @media/@supports/@layer/@container wrap other rules and need their body recursed into.
// Anything else starting with '@' (@keyframes, @font-face, @page, ...) has a
// prelude that isn't an element selector, so it passes through untouched.
const CONTAINER_AT_RULES = new Set(['media', 'supports', 'layer', 'container'])

// Matches one or more trailing pseudo-class/element segments, e.g. ':hover',
// '::before', or a chain like ':not(.x):hover' — used to insert the scope
// attribute before them rather than after.
const TRAILING_PSEUDO = /(::?[\w-]+(?:\([^)]*\))?)+$/

export function scopeCss(css: string, hash: string): string {
  return scopeBlock(css, hash)
}

function scopeBlock(css: string, hash: string): string {
  let out = ''
  let i = 0

  while (i < css.length) {
    if (css[i] === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      const close = end === -1 ? css.length : end + 2
      out += css.slice(i, close)
      i = close
      continue
    }
    if (/\s/.test(css[i])) {
      out += css[i]
      i++
      continue
    }

    const ruleStart = i
    let depthParen = 0
    let j = i
    while (j < css.length) {
      const ch = css[j]
      if (ch === '(') { depthParen++; j++; continue }
      if (ch === ')') { depthParen--; j++; continue }
      if (ch === '/' && css[j + 1] === '*') {
        const end = css.indexOf('*/', j + 2)
        j = end === -1 ? css.length : end + 2
        continue
      }
      if (depthParen === 0 && (ch === '{' || ch === ';')) break
      j++
    }
    if (j >= css.length) {
      out += css.slice(ruleStart)
      break
    }
    const prelude = css.slice(ruleStart, j)
    if (css[j] === ';') {
      out += prelude + ';'
      i = j + 1
      continue
    }

    const bodyStart = j + 1
    let depthBrace = 1
    let k = bodyStart
    while (k < css.length && depthBrace > 0) {
      if (css[k] === '{') { depthBrace++; k++; continue }
      if (css[k] === '}') { depthBrace--; k++; continue }
      if (css[k] === '/' && css[k + 1] === '*') {
        const end = css.indexOf('*/', k + 2)
        k = end === -1 ? css.length : end + 2
        continue
      }
      k++
    }
    if (depthBrace > 0) {
      // Unbalanced braces (malformed CSS) — emit the remainder verbatim
      // rather than fabricating a closing brace or truncating content.
      out += css.slice(ruleStart)
      break
    }
    const bodyEnd = k - 1
    const body = css.slice(bodyStart, bodyEnd)

    const trimmedPrelude = prelude.trim()
    if (trimmedPrelude.startsWith('@')) {
      const name = (trimmedPrelude.slice(1).match(/^[\w-]+/) ?? [''])[0]
      out += CONTAINER_AT_RULES.has(name)
        ? `${prelude}{${scopeBlock(body, hash)}}`
        : `${prelude}{${body}}`
    } else {
      out += `${scopeSelectorList(prelude, hash)}{${body}}`
    }
    i = bodyEnd + 1
  }

  return out
}

function scopeSelectorList(selectorList: string, hash: string): string {
  return splitTopLevel(selectorList, ',')
    .map(sel => scopeSelector(sel.trim(), hash))
    .join(', ')
}

// Splits on a delimiter, but only outside parens — so `:is(.a, .b)` isn't
// mistaken for two selectors in a comma-separated selector list.
function splitTopLevel(value: string, delimiter: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === delimiter && depth === 0) {
      parts.push(value.slice(start, i))
      start = i + 1
    }
  }
  parts.push(value.slice(start))
  return parts
}

function scopeSelector(selector: string, hash: string): string {
  if (!selector) return selector
  const attr = `[data-wald-${hash}]`
  const match = selector.match(TRAILING_PSEUDO)
  if (match && match.index !== undefined) {
    const matchedText = selector.slice(match.index)
    // If the matched pseudo-classes start with :is/:where/:not containing a comma
    // (indicating a selector list), place scope after the entire pseudo-class chain
    if (/^:(?:is|where|not)\([^)]*,[^)]*\)/.test(matchedText)) {
      return `${selector}${attr}`
    }
    // Otherwise, place scope before the matched pseudo-classes
    return `${selector.slice(0, match.index)}${attr}${selector.slice(match.index)}`
  }
  return `${selector}${attr}`
}
