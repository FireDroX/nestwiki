export class ImportTooLargeException extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ImportTooLargeException';
  }
}
