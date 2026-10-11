import { describe, expect, it } from 'vitest'
import type { MergeSegment } from '#api/pages'
import { resolveMergeSegments } from './resolve-merge-segments'

const segments: MergeSegment[] = [
  { type: 'ok', lines: ['Intro'] },
  { type: 'conflict', mine: ['Mine A'], base: ['Base A'], theirs: ['Theirs A'] },
  { type: 'ok', lines: ['Middle'] },
  { type: 'conflict', mine: [], base: ['Base B'], theirs: ['Theirs B1', 'Theirs B2'] },
]

describe('resolveMergeSegments', () => {
  it('returns null while a conflict has no choice', () => {
    expect(resolveMergeSegments(segments, { 1: 'mine' })).toBeNull()
  })

  it('keeps mine, theirs or both in order', () => {
    expect(resolveMergeSegments(segments, { 1: 'mine', 3: 'theirs' })).toBe(
      'Intro\nMine A\nMiddle\nTheirs B1\nTheirs B2',
    )
    expect(resolveMergeSegments(segments, { 1: 'both', 3: 'mine' })).toBe('Intro\nMine A\nTheirs A\nMiddle')
  })

  it('returns the ok lines when there is no conflict', () => {
    expect(resolveMergeSegments([{ type: 'ok', lines: ['a', 'b'] }], {})).toBe('a\nb')
  })
})
