export class DefaultAdminConfigurationException extends Error {
  constructor(readonly problems: string[]) {
    super(
      [
        'No admin account exists yet and the default admin cannot be created from backend/.env:',
        ...problems.map((problem) => `  - ${problem}`),
        'Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_DISPLAY_NAME, then restart.',
      ].join('\n'),
    );
    this.name = 'DefaultAdminConfigurationException';
  }
}
