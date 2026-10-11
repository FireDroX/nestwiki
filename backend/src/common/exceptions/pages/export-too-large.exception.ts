export class ExportTooLargeException extends Error {
  constructor() {
    super('This export is too large, export a smaller part of the wiki');
    this.name = 'ExportTooLargeException';
  }
}
