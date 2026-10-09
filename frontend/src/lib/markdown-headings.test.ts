import { describe, expect, it } from 'vitest'
import { HeadingSlugger, toHeadingSlug } from './markdown-headings'

describe('toHeadingSlug', () => {
  it.each([
    ['Installation', 'installation'],
    ['Guide de démarrage', 'guide-de-démarrage'],
    ['Formules LaTeX (pages)', 'formules-latex-pages'],
    ["C'est quoi ? Une FAQ !", 'cest-quoi--une-faq-'],
    ['  Espaces autour  ', 'espaces-autour'],
    ['snake_case & co', 'snake_case--co'],
    ['Étape 2.1', 'étape-21'],
  ])('slugifies %j as %j', (text, slug) => {
    expect(toHeadingSlug(text)).toBe(slug)
  })
})

describe('HeadingSlugger', () => {
  it('suffixes duplicate slugs', () => {
    const slugger = new HeadingSlugger()
    expect(slugger.slug('Exemple')).toBe('exemple')
    expect(slugger.slug('Exemple')).toBe('exemple-1')
    expect(slugger.slug('Exemple')).toBe('exemple-2')
  })

  it('avoids an id reserved by a hand-written heading', () => {
    const slugger = new HeadingSlugger()
    slugger.reserve('exemple')
    expect(slugger.slug('Exemple')).toBe('exemple-1')
  })

  it('returns an empty slug for text without any slug character', () => {
    const slugger = new HeadingSlugger()
    expect(slugger.slug('!!!')).toBe('')
    expect(slugger.slug('???')).toBe('')
  })
})
