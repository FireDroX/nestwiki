import { describe, expect, it } from 'vitest';
import { ChangelogNotFoundException } from '../common/exceptions/content/changelog-not-found.exception.js';
import { InvalidChangelogException } from '../common/exceptions/content/invalid-changelog.exception.js';
import {
  CHANGELOG_PATH,
  groupByMinor,
  loadChangelog,
  parseChangelog,
  renderReleaseNotesPage,
  type ReleaseEntry,
} from './release-notes.js';

const CHANGELOG = `# Changelog

Intro text that is not a release.

## 1.0.1 — 2026-10-05

- Second 1.0 change
  - nested detail

- Paragraph after a blank line

## 1.0.0 — 2026-10-04

- First 1.0 change

## 0.31.2 — 2026-10-03

- Fix

## 0.10.0 — 2026-09-01

- Ten

## 0.9.3 — 2026-08-30

- Nine
`;

function entry(version: string): ReleaseEntry {
  return { version, date: '2026-01-01', body: `- ${version}` };
}

describe('parseChangelog', () => {
  it('reads every release section with its version, date and full body, ignoring the header', () => {
    const entries = parseChangelog(CHANGELOG);

    expect(entries.map((release) => release.version)).toEqual([
      '1.0.1',
      '1.0.0',
      '0.31.2',
      '0.10.0',
      '0.9.3',
    ]);
    expect(entries[0]).toEqual({
      version: '1.0.1',
      date: '2026-10-05',
      body: '- Second 1.0 change\n  - nested detail\n\n- Paragraph after a blank line',
    });
  });

  it('accepts Windows line endings', () => {
    const entries = parseChangelog(CHANGELOG.replace(/\n/g, '\r\n'));

    expect(entries).toHaveLength(5);
    expect(entries[4].body).toBe('- Nine');
  });

  it('rejects a changelog without any release section', () => {
    expect(() => parseChangelog('# Changelog\n\nNothing yet.\n')).toThrow(
      InvalidChangelogException,
    );
  });
});

describe('groupByMinor', () => {
  it('groups by minor version, newest minor and newest patch first, comparing numbers not strings', () => {
    const groups = groupByMinor(
      ['0.9.3', '1.0.0', '0.10.0', '0.31.2', '1.0.1', '0.31.10'].map(entry),
    );

    expect(groups.map((group) => group.minor)).toEqual([
      '1.0',
      '0.31',
      '0.10',
      '0.9',
    ]);
    expect(groups[0].entries.map((release) => release.version)).toEqual([
      '1.0.1',
      '1.0.0',
    ]);
    expect(groups[1].entries.map((release) => release.version)).toEqual([
      '0.31.10',
      '0.31.2',
    ]);
  });
});

describe('renderReleaseNotesPage', () => {
  const page = renderReleaseNotesPage(parseChangelog(CHANGELOG));

  it('renders one radio, one menu entry and one panel per minor version', () => {
    for (const id of ['rn-1-0', 'rn-0-31', 'rn-0-10', 'rn-0-9']) {
      expect(page).toContain(`id="${id}"`);
      expect(page).toContain(`for="${id}"`);
      expect(page).toContain(`id="panel-${id}"`);
    }
    expect(page.match(/type="radio"/g)).toHaveLength(4);
  });

  it('shows the newest minor by default without a checked attribute and without any script', () => {
    expect(page).not.toMatch(/<input[^>]*checked/);
    expect(page).not.toMatch(/<script/i);
    expect(page).toMatch(/class="rn-panel rn-panel-latest" id="panel-rn-1-0"/);
  });

  it('keeps every release heading and body as Markdown inside its panel', () => {
    expect(page).toContain('### 1.0.1 — 2026-10-05');
    expect(page).toContain('- Paragraph after a blank line');
    expect(page.indexOf('### 0.9.3')).toBeGreaterThan(
      page.indexOf('### 0.10.0'),
    );
  });

  it('labels each minor with its number of updates, singular and plural', () => {
    expect(page).toContain('2 mises à jour');
    expect(page).toContain('1 mise à jour');
  });

  it('starts with the page title', () => {
    expect(page.startsWith('# Notes de version\n')).toBe(true);
  });
});

describe('loadChangelog', () => {
  it('reads the CHANGELOG.md at the repository root', () => {
    expect(parseChangelog(loadChangelog()).length).toBeGreaterThan(0);
    expect(CHANGELOG_PATH.replace(/\\/g, '/')).toMatch(/\/CHANGELOG\.md$/);
  });

  it('fails with an explicit error when the file is missing', () => {
    expect(() => loadChangelog('/definitely/missing/CHANGELOG.md')).toThrow(
      ChangelogNotFoundException,
    );
  });
});
