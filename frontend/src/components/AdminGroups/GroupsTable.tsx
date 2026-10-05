import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ResponsiveTable, type ResponsiveColumn } from '#components/ResponsiveTable'
import { RenameGroupDialog } from '#components/AdminGroups/RenameGroupDialog'
import { DeleteGroupDialog } from '#components/AdminGroups/DeleteGroupDialog'
import type { GroupSummary } from '#api/groups'

interface GroupsTableProps {
  groups: GroupSummary[]
  pendingGroupId: string | null
  onRenamed: (id: string, name: string, description: string | null) => void
  onDelete: (group: GroupSummary) => void
}

export function GroupsTable({ groups, pendingGroupId, onRenamed, onDelete }: GroupsTableProps) {
  const { t } = useTranslation()

  const columns: ResponsiveColumn<GroupSummary>[] = [
    {
      id: 'name',
      header: t('admin.groups.columnName'),
      primary: true,
      cell: (group) => (
        <Link to={`/admin/groups/${group.id}`} className="block min-w-0 hover:underline">
          <p className="font-medium">{group.name}</p>
          {group.description && (
            <p className="truncate text-sm font-normal text-muted-foreground">{group.description}</p>
          )}
        </Link>
      ),
    },
    {
      id: 'members',
      header: t('admin.groups.columnMembers'),
      className: 'text-muted-foreground',
      cell: (group) => group.memberCount,
    },
    {
      id: 'rules',
      header: t('admin.groups.columnRules'),
      className: 'text-muted-foreground',
      cell: (group) => group.ruleCount,
    },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      rows={groups}
      rowKey={(group) => group.id}
      actions={(group) => (
        <>
          <RenameGroupDialog
            groupId={group.id}
            currentName={group.name}
            currentDescription={group.description}
            onRenamed={(name, description) => onRenamed(group.id, name, description)}
          />
          <DeleteGroupDialog group={group} pending={pendingGroupId === group.id} onConfirm={() => onDelete(group)} />
        </>
      )}
    />
  )
}
