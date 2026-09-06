// Renders compile/render failures during `wald grow` as a readable HTML page
// instead of a bare 500 with a plain-text stack. It goes through
// vite.transformIndexHtml() the same way a normal page response does (see
// grow.ts), so the Vite HMR client still connects on an error page and the
// browser auto-reloads on its own once the underlying file is fixed.

type LocatedError = Error & {
  loc?: { file?: string; line?: number; column?: number }
  frame?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function renderErrorPage(error: LocatedError): string {
  const message = escapeHtml(error.message ?? String(error))
  const stack = error.stack ? escapeHtml(error.stack) : ''
  const loc = error.loc
  const location = loc
    ? `<p class="loc">${escapeHtml(String(loc.file ?? ''))}${loc.line !== undefined ? `:${loc.line}` : ''}${loc.column !== undefined ? `:${loc.column}` : ''}</p>`
    : ''
  const frame = error.frame ? `<pre class="frame">${escapeHtml(error.frame)}</pre>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <title>Error — WaldJS</title>
  <style>
    body { margin: 0; padding: 2rem; background: #1e1e1e; color: #f0f0f0; font-family: ui-monospace, monospace; }
    h1 { color: #ff5f5f; font-size: 1.1rem; margin: 0 0 1rem; white-space: pre-wrap; }
    .loc { color: #9cdcfe; margin: 0 0 1rem; }
    pre { background: #111; padding: 1rem; border-radius: 6px; overflow: auto; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${message}</h1>
  ${location}
  ${frame}
  ${stack ? `<pre class="stack">${stack}</pre>` : ''}
</body>
</html>`
}
