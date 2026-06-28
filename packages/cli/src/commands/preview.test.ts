import { describe, it, expect } from 'vitest'
import { startPreview } from './preview.js'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('startPreview', () => {
  it('starts a server and serves index.html', async () => {
    const distDir = mkdtempSync(join(tmpdir(), 'wald-preview-'))
    writeFileSync(join(distDir, 'index.html'), '<h1>Preview</h1>')

    const server = await startPreview(distDir, 0) // port 0 = OS assigns free port
    const { port } = server.address() as { port: number }

    const res = await fetch(`http://localhost:${port}/`)
    const text = await res.text()

    server.close()
    expect(text).toContain('<h1>Preview</h1>')
  })
})
