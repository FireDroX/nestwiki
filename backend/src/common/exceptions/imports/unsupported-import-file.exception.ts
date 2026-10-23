export class UnsupportedImportFileException extends Error {
  constructor() {
    super('The file must be a .zip archive or a .md file');
    this.name = 'UnsupportedImportFileException';
  }
}
