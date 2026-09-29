import { describe, it, expect } from 'vitest'
import { SafeHtml } from '@waldjs/runtime'
import { STRINGS, bilingualHtml, ui } from './strings'

describe('bilingualHtml', () => {
  it('renders an nl span followed by an en span, leaving inner HTML intact', () => {
    expect(bilingualHtml({ nl: 'Naar <b>dist/</b>', en: 'To <b>dist/</b>' }))
      .toBe('<span class="nl">Naar <b>dist/</b></span><span class="en">To <b>dist/</b></span>')
  })
})

describe('ui', () => {
  it('exposes every dictionary entry as SafeHtml of its bilingual pair', () => {
    for (const [group, entries] of Object.entries(STRINGS)) {
      for (const [key, pair] of Object.entries(entries)) {
        const value = (ui as Record<string, Record<string, SafeHtml>>)[group][key]
        expect(value).toBeInstanceOf(SafeHtml)
        expect(value.value).toBe(bilingualHtml(pair))
      }
    }
  })

  it('has no empty translations', () => {
    for (const entries of Object.values(STRINGS)) {
      for (const pair of Object.values(entries) as { nl: string; en: string }[]) {
        expect(pair.nl.trim()).not.toBe('')
        expect(pair.en.trim()).not.toBe('')
      }
    }
  })
})
