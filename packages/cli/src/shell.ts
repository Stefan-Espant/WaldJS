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

export function hoistScripts(html: string): string {
  const seen = new Set<string>()
  const collected: string[] = []
  const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    if (!seen.has(match)) {
      seen.add(match)
      collected.push(match)
    }
    return ''
  })
  if (collected.length === 0) return html
  return stripped.replace('</body>', collected.join('\n') + '\n</body>')
}
