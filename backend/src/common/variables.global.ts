export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 100;
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';
export const SLUG_REGEX = /^[a-z0-9-]+$/;
export const SLUG_MAX_LENGTH = 255;
export const RESERVED_ROOT_PAGE_SLUGS: readonly string[] = ['tree'];
export const RESERVED_CHILD_OF_ROOT_PAGE_SLUGS: readonly string[] = [
  'versions',
  'comments',
  'tags',
  'access-rules',
  'stats',
];
export const TITLE_MAX_LENGTH = 255;
export const CHANGE_SUMMARY_MAX_LENGTH = 255;
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_ATTACHMENT_SIZE_MB = 20;
export const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
];
// 7 days: the max SigV4 allows (AWS-compatible signing, enforced the
// same way by Minio) — as long as this is the value embedded directly
// in page markdown (no refresh-on-render mechanism yet), longer is
// better; still not permanent, a URL embedded and left untouched past
// this window will break and need re-uploading.
export const MEDIA_PRESIGNED_URL_EXPIRY_SECONDS = 604800;
export const SUPPORTED_LOCALES = ['fr', 'en'];
export const TAG_NAME_MAX_LENGTH = 50;
export const TAG_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
export const DEFAULT_TAG_COLOR = '#6b7280';
export const MCP_AUDIT_LOG_DEFAULT_LIMIT = 50;
export const MCP_AUDIT_LOG_MAX_LIMIT = 200;
export const MCP_AUDIT_LOG_STRING_MAX_LENGTH = 500;
export const AVATAR_MAX_SIZE_MB = 2;
export const AVATAR_MAX_SIZE_BYTES = AVATAR_MAX_SIZE_MB * 1024 * 1024;
export const AVATAR_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const ACCOUNT_LOCKOUT_DURATION_MINUTES = 15;
export const COMMENT_CONTENT_MAX_LENGTH = 2000;
export const POPULAR_PAGES_DEFAULT_LIMIT = 5;
export const POPULAR_PAGES_MAX_LIMIT = 20;
export const MCP_SCOPES = [
  'pages:read',
  'pages:write',
  'tags:read',
  'tags:write',
  'users:read',
  'users:write',
  'media:read',
  'media:write',
  'search:read',
];

export const OAUTH_CLIENT_ID_PREFIX = 'oauth_client_';
export const OAUTH_CLIENT_SECRET_PREFIX = 'oauth_secret_';
export const OAUTH_REFRESH_TOKEN_PREFIX = 'oauth_rt_';
export const OAUTH_AUTHORIZATION_CODE_PREFIX = 'oauth_code_';
export const OAUTH_AUTHORIZATION_CODE_EXPIRY_SECONDS = 60;
export const OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS = 3600;
export const OAUTH_REFRESH_TOKEN_EXPIRY_DAYS = 30;
export const OAUTH_PKCE_CODE_CHALLENGE_METHOD = 'S256';
