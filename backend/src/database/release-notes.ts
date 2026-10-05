import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ChangelogNotFoundException } from '../common/exceptions/content/changelog-not-found.exception.js';
import { InvalidChangelogException } from '../common/exceptions/content/invalid-changelog.exception.js';

export const CHANGELOG_PATH = fileURLToPath(
  new URL('../../../CHANGELOG.md', import.meta.url),
);

const RELEASE_HEADING = /^## (\d+)\.(\d+)\.(\d+) — (\d{4}-\d{2}-\d{2})\s*$/;

export interface ReleaseEntry {
  version: string;
  date: string;
  body: string;
}

export interface MinorRelease {
  minor: string;
  entries: ReleaseEntry[];
}

export function loadChangelog(path: string = CHANGELOG_PATH): string {
  if (!existsSync(path)) {
    throw new ChangelogNotFoundException(path);
  }
  return readFileSync(path, 'utf-8');
}

export function parseChangelog(markdown: string): ReleaseEntry[] {
  const entries: ReleaseEntry[] = [];
  let current: { version: string; date: string; lines: string[] } | null = null;

  const flush = () => {
    if (current) {
      entries.push({
        version: current.version,
        date: current.date,
        body: current.lines.join('\n').trim(),
      });
    }
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = RELEASE_HEADING.exec(line);
    if (heading) {
      flush();
      current = {
        version: `${heading[1]}.${heading[2]}.${heading[3]}`,
        date: heading[4],
        lines: [],
      };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();

  if (entries.length === 0) {
    throw new InvalidChangelogException(
      'no "## <major>.<minor>.<patch> — <YYYY-MM-DD>" release section found',
    );
  }
  return entries;
}

function versionNumbers(version: string): number[] {
  return version.split('.').map(Number);
}

function compareDescending(left: number[], right: number[]): number {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (right[index] ?? 0) - (left[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

export function groupByMinor(entries: ReleaseEntry[]): MinorRelease[] {
  const groups = new Map<string, ReleaseEntry[]>();
  for (const entry of entries) {
    const [major, minor] = versionNumbers(entry.version);
    const key = `${major}.${minor}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) =>
      compareDescending(versionNumbers(left), versionNumbers(right)),
    )
    .map(([minor, minorEntries]) => ({
      minor,
      entries: [...minorEntries].sort((left, right) =>
        compareDescending(
          versionNumbers(left.version),
          versionNumbers(right.version),
        ),
      ),
    }));
}

function radioId(minor: string): string {
  return `rn-${minor.replace('.', '-')}`;
}

function updateCount(count: number): string {
  return count === 1 ? '1 mise à jour' : `${count} mises à jour`;
}

const BASE_STYLES = `.rn { position: relative; }
.rn-radio { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.rn-picker { position: relative; display: inline-block; max-width: 100%; margin: 0.25rem 0 1rem; outline: none; }
.rn-trigger { display: inline-flex; align-items: center; gap: 0.5rem; min-height: 2.5rem; max-width: 100%; padding: 0.5rem 0.875rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--background); color: var(--foreground); font-weight: 500; cursor: pointer; }
.rn-trigger::after { content: "▾"; color: var(--muted-foreground); }
.rn-picker:focus-visible .rn-trigger { outline: 2px solid var(--ring); outline-offset: 2px; }
.rn-menu { display: none; position: absolute; z-index: 20; top: calc(100% + 0.25rem); left: 0; min-width: 100%; max-height: 20rem; overflow-y: auto; padding: 0.25rem; border: 1px solid var(--border); border-radius: var(--radius); background: var(--popover); color: var(--popover-foreground); box-shadow: 0 8px 24px rgb(0 0 0 / 0.18); }
.rn-picker:focus-within .rn-menu { display: block; }
.rn-menu label { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; min-height: 2.5rem; padding: 0.5rem 0.75rem; border-radius: calc(var(--radius) - 2px); white-space: nowrap; cursor: pointer; }
.rn-menu label:hover { background: var(--accent); color: var(--accent-foreground); }
.rn-count { color: var(--muted-foreground); font-size: 0.75rem; font-weight: 400; }
.rn-current, .rn-panel { display: none; }
.rn-current-latest, .rn-panel-latest { display: inline; }
.rn-panel-latest { display: block; }
.rn-label-latest { font-weight: 600; }
.rn-radio:checked ~ .rn-picker .rn-current-latest, .rn-radio:checked ~ .rn-panel-latest { display: none; }
.rn-radio:checked ~ .rn-picker .rn-label-latest { font-weight: inherit; }`;

function minorStyles(id: string): string {
  return [
    `#${id}:checked ~ #panel-${id} { display: block; }`,
    `#${id}:checked ~ .rn-picker .rn-current-${id} { display: inline; }`,
    `#${id}:checked ~ .rn-picker label[for="${id}"] { font-weight: 600; background: var(--accent); }`,
  ].join('\n');
}

function latestClass(index: number, base: string): string {
  return index === 0 ? `${base} ${base}-latest` : base;
}

export function renderReleaseNotesPage(entries: ReleaseEntry[]): string {
  const groups = groupByMinor(entries);
  const ids = groups.map((group) => radioId(group.minor));

  const styles = [BASE_STYLES, ...ids.map(minorStyles)].join('\n');

  const radios = groups.map(
    (group, index) =>
      `<input class="rn-radio" type="radio" name="release-notes" id="${ids[index]}" aria-label="Version ${group.minor}">`,
  );

  const currentLabels = groups.map(
    (group, index) =>
      `<span class="${latestClass(index, 'rn-current')} rn-current-${ids[index]}">Version ${group.minor} <span class="rn-count">· ${updateCount(group.entries.length)}</span></span>`,
  );

  const menuLabels = groups.map(
    (group, index) =>
      `<label class="${latestClass(index, 'rn-label')}" for="${ids[index]}">Version ${group.minor} <span class="rn-count">${updateCount(group.entries.length)}</span></label>`,
  );

  const panels = groups.map((group, index) =>
    [
      `<div class="${latestClass(index, 'rn-panel')}" id="panel-${ids[index]}">`,
      '',
      ...group.entries.flatMap((entry) => [
        `### ${entry.version} — ${entry.date}`,
        '',
        entry.body,
        '',
      ]),
      '</div>',
    ].join('\n'),
  );

  return [
    '# Notes de version',
    '',
    'Choisissez une version pour afficher toutes ses mises à jour, de la plus récente à la plus ancienne.',
    '',
    `<style>\n${styles}\n</style>`,
    '',
    [
      '<div class="rn">',
      ...radios,
      '<div class="rn-picker" tabindex="0">',
      `<span class="rn-trigger">${currentLabels.join('')}</span>`,
      `<div class="rn-menu">`,
      ...menuLabels,
      '</div>',
      '</div>',
    ].join('\n'),
    '',
    panels.join('\n\n'),
    '',
    '</div>',
    '',
  ].join('\n');
}
