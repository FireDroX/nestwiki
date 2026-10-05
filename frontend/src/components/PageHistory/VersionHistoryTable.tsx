import { useTranslation } from 'react-i18next'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import { RestoreVersionButton } from '#components/PageHistory/RestoreVersionButton'
import { VersionContentDialog } from '#components/PageHistory/VersionContentDialog'
import type { VersionSummary } from '#api/versions'
import { formatDateTime, formatRelativeTime } from '#utils/relative-time'

interface VersionHistoryTableProps {
  pageId: string
  versions: VersionSummary[]
  currentUserId: string | undefined
  selectedIds: string[]
  onToggleSelected: (versionId: string) => void
  canRestore: boolean
  onRestored: () => void
}

export function VersionHistoryTable({
  pageId,
  versions,
  currentUserId,
  selectedIds,
  onToggleSelected,
  canRestore,
  onRestored,
}: VersionHistoryTableProps) {
  const { t } = useTranslation()

  function authorLabel(authorId: string): string {
    if (authorId === currentUserId) {
      return t('pageHistory.you')
    }
    return `${authorId.slice(0, 8)}…`
  }

  function handleSelectedChange(keys: string[]) {
    const toggled = keys.find((key) => !selectedIds.includes(key)) ?? selectedIds.find((key) => !keys.includes(key))
    if (toggled) {
      onToggleSelected(toggled)
    }
  }

  const columns: ResponsiveColumn<VersionSummary>[] = [
    {
      id: 'author',
      header: t('pageHistory.columnAuthor'),
      primary: true,
      className: 'font-medium',
      cell: (version) => authorLabel(version.authorId),
    },
    {
      id: 'date',
      header: t('pageHistory.columnDate'),
      className: 'text-muted-foreground',
      cell: (version) => <span title={formatDateTime(version.createdAt)}>{formatRelativeTime(version.createdAt)}</span>,
    },
    {
      id: 'summary',
      header: t('pageHistory.columnSummary'),
      className: 'max-w-[140px] truncate text-muted-foreground',
      cell: (version) => version.changeSummary ?? t('pageHistory.noSummary'),
    },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      rows={versions}
      rowKey={(version) => version.id}
      selection={{
        selectedKeys: selectedIds,
        onSelectedChange: handleSelectedChange,
        selectRowLabel: (version) =>
          t('pageHistory.selectVersion', { date: formatDateTime(version.createdAt) }),
      }}
      actionsHeader={t('pageHistory.columnActions')}
      actions={(version) => (
        <>
          <VersionContentDialog pageId={pageId} versionId={version.id} />
          {canRestore && <RestoreVersionButton pageId={pageId} versionId={version.id} onRestored={onRestored} />}
        </>
      )}
    />
  )
}
