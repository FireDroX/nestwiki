export class AccessRuleNotFoundException extends Error {
  constructor() {
    super('Access rule not found');
    this.name = 'AccessRuleNotFoundException';
  }
}
