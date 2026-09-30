import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'
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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.groups.columnName')}</TableHead>
          <TableHead>{t('admin.groups.columnMembers')}</TableHead>
          <TableHead>{t('admin.groups.columnRules')}</TableHead>
          <TableHead className="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group.id}>
            <TableCell>
              <Link to={`/admin/groups/${group.id}`} className="hover:underline">
                <p className="font-medium">{group.name}</p>
                {group.description && <p className="truncate text-sm text-muted-foreground">{group.description}</p>}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{group.memberCount}</TableCell>
            <TableCell className="text-muted-foreground">{group.ruleCount}</TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <RenameGroupDialog
                  groupId={group.id}
                  currentName={group.name}
                  currentDescription={group.description}
                  onRenamed={(name, description) => onRenamed(group.id, name, description)}
                />
                <DeleteGroupDialog
                  group={group}
                  pending={pendingGroupId === group.id}
                  onConfirm={() => onDelete(group)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
