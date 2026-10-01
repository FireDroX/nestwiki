export class InsufficientPermissionException extends Error {
  constructor() {
    super('Insufficient permission');
    this.name = 'InsufficientPermissionException';
  }
}
