export class InvalidImportArchiveException extends Error {
  constructor(reason = 'The archive is invalid or corrupted') {
    super(reason);
    this.name = 'InvalidImportArchiveException';
  }
}
