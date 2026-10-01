export class GroupNameAlreadyExistsException extends Error {
  constructor() {
    super('Group name already exists');
    this.name = 'GroupNameAlreadyExistsException';
  }
}
