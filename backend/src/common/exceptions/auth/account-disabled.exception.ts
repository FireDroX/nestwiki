export class AccountDisabledException extends Error {
  constructor() {
    super('Account disabled');
    this.name = 'AccountDisabledException';
  }
}
