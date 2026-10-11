export class ParentInTrashException extends Error {
  constructor() {
    super('Restore the parent page first');
    this.name = 'ParentInTrashException';
  }
}
