export class VersionDiffTooLargeException extends Error {
  constructor() {
    super('These versions differ too much to be compared line by line');
    this.name = 'VersionDiffTooLargeException';
  }
}
