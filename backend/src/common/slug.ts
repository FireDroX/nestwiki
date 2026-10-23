const NON_HEADING_SLUG_CHARACTERS = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toHeadingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(NON_HEADING_SLUG_CHARACTERS, '')
    .replace(/ /g, '-');
}

export function toComparableName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
