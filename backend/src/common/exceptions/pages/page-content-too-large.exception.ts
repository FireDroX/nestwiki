import { PAGE_CONTENT_MAX_LENGTH } from '../../variables.global.js';

export class PageContentTooLargeException extends Error {
  constructor() {
    super(
      `content must be shorter than or equal to ${PAGE_CONTENT_MAX_LENGTH} characters`,
    );
    this.name = 'PageContentTooLargeException';
  }
}
