import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import { AddToGroupDialog } from '#components/AdminUsers/AddToGroupDialog'
import { CreateGroupDialog } from '#components/AdminGroups/CreateGroupDialog'

interface UsersBulkActionsBarProps {
  selectedUserIds: string[]
  onDone: () => void
}

export function UsersBulkActionsBar({ selectedUserIds, onDone }: UsersBulkActionsBarProps) {
  const { t } = useTranslation()
  const [addToGroupOpen, setAddToGroupOpen] = useState(false)

  if (selectedUserIds.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 sm:gap-3">
      <p className="text-sm font-medium">{t('admin.users.selectedCount', { count: selectedUserIds.length })}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setAddToGroupOpen(true)}>
        {t('admin.users.bulkAddToGroup')}
      </Button>
      <CreateGroupDialog
        trigger={
          <Button type="button" variant="outline" size="sm">
            {t('admin.users.bulkCreateGroup')}
          </Button>
        }
        description={t('admin.users.bulkCreateGroupDescription', { count: selectedUserIds.length })}
        extraUserIds={selectedUserIds}
        onCreated={onDone}
      />

      <AddToGroupDialog
        open={addToGroupOpen}
        onOpenChange={setAddToGroupOpen}
        userIds={selectedUserIds}
        onDone={onDone}
      />
    </div>
  )
}
