import { toast } from 'sonner'
import i18n from '#lib/i18n'

const BROKEN_LINKS_WARNING_DURATION_MS = 10_000

export function warnAboutBrokenLinks(brokenLinks: string[] | undefined): void {
  if (!brokenLinks?.length) {
    return
  }
  toast.warning(i18n.t('pageEditor.brokenLinksWarning', { count: brokenLinks.length }), {
    duration: BROKEN_LINKS_WARNING_DURATION_MS,
    description: (
      <ul className="font-mono text-xs break-all">
        {brokenLinks.map((path) => (
          <li key={path}>{path}</li>
        ))}
      </ul>
    ),
  })
}
