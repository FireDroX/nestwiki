export class ReservedSlugException extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" is reserved and cannot be used for a page`);
    this.name = 'ReservedSlugException';
  }
}
