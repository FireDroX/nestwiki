export class MergeTooLargeException extends Error {
  constructor() {
    super(
      'These changes are too far apart to be merged automatically, reload the page and apply them again',
    );
    this.name = 'MergeTooLargeException';
  }
}
