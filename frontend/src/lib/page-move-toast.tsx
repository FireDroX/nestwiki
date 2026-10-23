import { toast } from 'sonner'
import type { PageMoveResult } from '#api/pages'
import i18n from '#lib/i18n'

const PAGE_MOVE_SUMMARY_DURATION_MS = 10_000

export function announcePageMove({ linksUpdated, pagesUpdated, pagesSkipped }: PageMoveResult): void {
  const details: string[] = []
  if (linksUpdated > 0) {
    details.push(
      i18n.t('pageEditor.movedLinksUpdated', {
        count: linksUpdated,
        pages: i18n.t('pageEditor.movedLinksPages', { count: pagesUpdated }),
      }),
    )
  }
  if (pagesSkipped > 0) {
    details.push(i18n.t('pageEditor.movedLinksSkipped', { count: pagesSkipped }))
  }

  const notify = pagesSkipped > 0 ? toast.warning : toast.success
  if (details.length === 0) {
    notify(i18n.t('pageEditor.pageMoved'))
    return
  }
  notify(i18n.t('pageEditor.pageMoved'), {
    duration: PAGE_MOVE_SUMMARY_DURATION_MS,
    description: (
      <ul>
        {details.map((detail) => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    ),
  })
}
