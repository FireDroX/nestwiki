export class DefaultAdminEmailTakenException extends Error {
  constructor() {
    super(
      'No admin account exists yet, but ADMIN_EMAIL already belongs to a non-admin account. Use another ADMIN_EMAIL; existing accounts are never promoted automatically.',
    );
    this.name = 'DefaultAdminEmailTakenException';
  }
}
