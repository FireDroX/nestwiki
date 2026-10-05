const SECRET_GENERATION_HINT =
  'Generate strong values with: openssl rand -hex 32';

export class InvalidEnvironmentException extends Error {
  constructor(readonly problems: string[]) {
    super(
      [
        'Invalid environment configuration, refusing to start:',
        ...problems.map((problem) => `  - ${problem}`),
        SECRET_GENERATION_HINT,
      ].join('\n'),
    );
    this.name = 'InvalidEnvironmentException';
  }
}
