export class ChangelogNotFoundException extends Error {
  constructor(path: string) {
    super(
      `CHANGELOG.md not found at ${path}: the release notes page is generated from it.`,
    );
    this.name = 'ChangelogNotFoundException';
  }
}
