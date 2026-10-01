export class GroupNotFoundException extends Error {
  constructor() {
    super('Group not found');
    this.name = 'GroupNotFoundException';
  }
}
