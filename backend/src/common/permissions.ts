export const GLOBAL_PERMISSIONS = [
  'page.create_root',
  'tag.create',
  'tag.delete',
  'media.upload',
  'media.delete',
  'comment.moderate',
  'user.manage',
] as const;
export type GlobalPermission = (typeof GLOBAL_PERMISSIONS)[number];

export const PAGE_ACTIONS = [
  'page.read',
  'page.edit',
  'page.create_child',
  'page.delete',
  'page.move',
  'page.manage_visibility',
  'page.manage_tags',
  'page.restore_version',
  'page.manage_permissions',
] as const;
export type PageAction = (typeof PAGE_ACTIONS)[number];
