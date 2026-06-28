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
