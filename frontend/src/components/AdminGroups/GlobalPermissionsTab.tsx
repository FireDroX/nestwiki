import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '#components/ui/checkbox'
import { Button } from '#components/ui/button'
import type { GlobalPermission } from '#api/permissions'
import { extractErrorMessage } from '#lib/api-errors'

const PERMISSION_CATEGORIES: { label: string; permissions: GlobalPermission[] }[] = [
  { label: 'pages', permissions: ['page.create_root'] },
  { label: 'tags', permissions: ['tag.create', 'tag.delete'] },
  { label: 'media', permissions: ['media.upload', 'media.delete'] },
  { label: 'comments', permissions: ['comment.moderate'] },
  { label: 'users', permissions: ['user.manage'] },
]

interface GlobalPermissionsTabProps {
  permissions: GlobalPermission[]
  onSave: (permissions: GlobalPermission[]) => Promise<void>
}

export function GlobalPermissionsTab({ permissions, onSave }: GlobalPermissionsTabProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Set<GlobalPermission>>(new Set(permissions))
  const [saving, setSaving] = useState(false)

  const dirty =
    selected.size !== permissions.length || permissions.some((permission) => !selected.has(permission))

  function toggle(permission: GlobalPermission, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(permission)
      } else {
        next.delete(permission)
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave([...selected])
      toast.success(t('admin.groups.permissionsSaved'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('admin.groups.permissionsSaveFailed')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {PERMISSION_CATEGORIES.map((category) => (
        <div key={category.label} className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">{t(`admin.groups.permissionCategories.${category.label}`)}</p>
          <div className="flex flex-col gap-2">
            {category.permissions.map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.has(permission)}
                  onCheckedChange={(checked) => toggle(permission, checked === true)}
                />
                {t(`permissions.labels.${permission}`)}
              </label>
            ))}
          </div>
        </div>
      ))}

      <Button type="button" size="sm" className="w-fit" disabled={!dirty || saving} onClick={handleSave}>
        {t('common.save')}
      </Button>
    </div>
  )
}
