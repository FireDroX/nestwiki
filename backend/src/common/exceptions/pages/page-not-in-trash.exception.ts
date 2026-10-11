export class PageNotInTrashException extends Error {
  constructor() {
    super('Page is not in the trash');
    this.name = 'PageNotInTrashException';
  }
}
