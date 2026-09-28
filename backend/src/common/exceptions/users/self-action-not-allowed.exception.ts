export class SelfActionNotAllowedException extends Error {
  constructor() {
    super('You cannot perform this action on your own account');
    this.name = 'SelfActionNotAllowedException';
  }
}
