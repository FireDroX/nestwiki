import { MarkdownLinkRewriter } from '../pages/services/markdown-link-rewriter.js';

type RunQuery = (query: string, parameters?: unknown[]) => Promise<unknown>;

export async function replacePageLinks(
  runQuery: RunQuery,
  pageId: string,
  versionId: string,
  targetPaths: string[],
): Promise<void> {
  await runQuery('DELETE FROM `page_links` WHERE `source_page_id` = ?', [
    pageId,
  ]);
  if (targetPaths.length > 0) {
    await runQuery(
      `INSERT INTO \`page_links\` (\`source_page_id\`, \`target_path\`) VALUES ${targetPaths.map(() => '(?, ?)').join(', ')}`,
      targetPaths.flatMap((targetPath) => [pageId, targetPath]),
    );
  }
  await runQuery('UPDATE `pages` SET `links_version_id` = ? WHERE `id` = ?', [
    versionId,
    pageId,
  ]);
}

export async function reindexStalePageLinks(
  runQuery: RunQuery,
  instanceUrl: string,
): Promise<number> {
  const stalePages = (await runQuery(
    'SELECT `id`, `current_version_id` FROM `pages` WHERE `deleted_at` IS NULL AND `current_version_id` IS NOT NULL AND NOT (`links_version_id` <=> `current_version_id`)',
  )) as { id: string; current_version_id: string }[];

  for (const { id, current_version_id: versionId } of stalePages) {
    const [version] = (await runQuery(
      'SELECT `content` FROM `page_versions` WHERE `id` = ?',
      [versionId],
    )) as { content: string }[];
    await replacePageLinks(
      runQuery,
      id,
      versionId,
      MarkdownLinkRewriter.findPagePaths(version?.content ?? '', instanceUrl),
    );
  }
  return stalePages.length;
}
