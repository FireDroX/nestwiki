export class AttachmentInUseException extends Error {
  constructor(pages: { title: string; inTrash: boolean }[]) {
    super(
      `Attachment is still referenced by: ${pages
        .map((page) => (page.inTrash ? `${page.title} (trash)` : page.title))
        .join(', ')}`,
    );
    this.name = 'AttachmentInUseException';
  }
}
