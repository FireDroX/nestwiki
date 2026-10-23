export class UnsafeImportPathException extends Error {
  constructor(entryName: string) {
    super(`The archive entry "${entryName}" has an unsafe path`);
    this.name = 'UnsafeImportPathException';
  }
}
