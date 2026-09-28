export class LastActiveAdminException extends Error {
  constructor() {
    super('Cannot remove or demote the last active admin');
    this.name = 'LastActiveAdminException';
  }
}
