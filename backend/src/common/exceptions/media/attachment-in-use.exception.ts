export class AttachmentInUseException extends Error {
  constructor(
    readablePages: { title: string; inTrash: boolean }[],
    hiddenPageCount: number,
  ) {
    super(AttachmentInUseException.describe(readablePages, hiddenPageCount));
    this.name = 'AttachmentInUseException';
  }

  private static describe(
    readablePages: { title: string; inTrash: boolean }[],
    hiddenPageCount: number,
  ): string {
    if (readablePages.length === 0) {
      return `Attachment is still referenced by ${hiddenPageCount} page(s)`;
    }
    const titles = readablePages
      .map((page) => (page.inTrash ? `${page.title} (trash)` : page.title))
      .join(', ');
    return hiddenPageCount > 0
      ? `Attachment is still referenced by: ${titles} and ${hiddenPageCount} other page(s)`
      : `Attachment is still referenced by: ${titles}`;
  }
}
