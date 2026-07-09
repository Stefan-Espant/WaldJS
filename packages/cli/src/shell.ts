export function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <title>WaldJS</title>
</head>
<body>
${content}
</body>
</html>`
}

export function maybeWrap(html: string): string {
  const t = html.trimStart()
  return t.startsWith('<!DOCTYPE') || t.startsWith('<html')
    ? html
    : wrapHtml(html)
}

const NO_HOIST_ATTR = /\sdata-wald-no-hoist(?=[\s=/>])/i

export function hoistScripts(html: string): string {
  const seen = new Set<string>()
  const collected: string[] = []
  const stripped = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, (match, openTag: string) => {
    // Scripts marked with data-wald-no-hoist stay exactly where the author put them
    // (e.g. an early inline script in <head> that must run before first paint).
    if (NO_HOIST_ATTR.test(openTag)) return match
    if (!seen.has(match)) {
      seen.add(match)
      collected.push(match)
    }
    return ''
  })
  if (collected.length === 0) return html
  return stripped.replace('</body>', collected.join('\n') + '\n</body>')
}
