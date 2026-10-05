export class InvalidChangelogException extends Error {
  constructor(message: string) {
    super(`Invalid CHANGELOG.md: ${message}`);
    this.name = 'InvalidChangelogException';
  }
}
