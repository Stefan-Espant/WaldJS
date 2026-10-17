// Kleine CSS-minifier voor de marketingbundel. Selectors en declaraties worden
// apart behandeld: in een selector is de spatie vóór ':' betekenisvol
// (`.a :is(b)` is een afstammeling, `.a:is(b)` het element zelf, zie #86),
// in een declaratie (`color : red`) niet. Strings (o.a. SVG-data-URI's) blijven
// ongemoeid.

export function minifyCss(css) {
  const strings = []
  let text = ''
  for (let i = 0; i < css.length; i++) {
    const char = css[i]
    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 1
      text += ' '
    } else if (char === '"' || char === "'") {
      let j = i + 1
      while (j < css.length && css[j] !== char) j += css[j] === '\\' ? 2 : 1
      strings.push(css.slice(i, j + 1))
      text += `\u0000${strings.length - 1}\u0000`
      i = j
    } else {
      text += char
    }
  }

  const collapsed = text.replace(/\s+/g, ' ')
  let out = ''
  for (const [, body, terminator] of collapsed.matchAll(/([^{};]*)([{};]?)/g)) {
    if (!body && !terminator) continue
    const isSelector = terminator === '{'
    const trimmed = body
      .trim()
      .replace(/\s*,\s*/g, ',')
      .replace(isSelector ? /:\s+/g : /\s*:\s*/g, ':')
    out += trimmed + terminator
  }

  return out
    .replace(/;}/g, '}')
    .replace(/\u0000(\d+)\u0000/g, (_, n) => strings[Number(n)])
    .trim()
}
