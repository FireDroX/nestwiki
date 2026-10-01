import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '#components/ui/checkbox'
import { Button } from '#components/ui/button'
import { setGlobalPermissions } from '#api/access-rules'
import { getEffectivePermissions, type AdminUserDetail } from '#api/users'
import type { GlobalPermission } from '#api/permissions'
import { extractErrorMessage } from '#lib/api-errors'

const PERMISSION_CATEGORIES: { label: string; permissions: GlobalPermission[] }[] = [
  { label: 'pages', permissions: ['page.create_root'] },
  { label: 'tags', permissions: ['tag.create', 'tag.delete'] },
  { label: 'media', permissions: ['media.upload', 'media.delete'] },
  { label: 'comments', permissions: ['comment.moderate'] },
  { label: 'users', permissions: ['user.manage'] },
]

interface UserPermissionsTabProps {
  user: AdminUserDetail
  onUpdated: (user: AdminUserDetail) => void
}

export function UserPermissionsTab({ user, onUpdated }: UserPermissionsTabProps) {
  const { t } = useTranslation()
  const [groupNamesByPermission, setGroupNamesByPermission] = useState<Map<GlobalPermission, string[]>>(new Map())
  const [selected, setSelected] = useState<Set<GlobalPermission>>(new Set(user.directPermissions))
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelected(new Set(user.directPermissions))
    getEffectivePermissions(user.id)
      .then((explanation) => {
        const map = new Map<GlobalPermission, string[]>()
        for (const entry of explanation.globalPermissions) {
          const groupNames = entry.origins
            .filter((origin) => origin.type === 'group')
            .map((origin) => origin.groupName)
          if (groupNames.length > 0) {
            map.set(entry.permission, groupNames)
          }
        }
        setGroupNamesByPermission(map)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const dirty =
    selected.size !== user.directPermissions.length || user.directPermissions.some((permission) => !selected.has(permission))

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
      const permissions = [...selected]
      await setGlobalPermissions({ type: 'user', id: user.id }, permissions)
      onUpdated({ ...user, directPermissions: permissions })
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
            {category.permissions.map((permission) => {
              const groupNames = groupNamesByPermission.get(permission) ?? []
              const isDirect = selected.has(permission)
              const inherited = loaded && groupNames.length > 0
              return (
                <label key={permission} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isDirect || inherited}
                    disabled={inherited}
                    onCheckedChange={(checked) => toggle(permission, checked === true)}
                  />
                  {t(`permissions.labels.${permission}`)}
                  {inherited && (
                    <span className="text-xs text-muted-foreground">
                      {t('admin.users.inheritedFromGroups', { groups: groupNames.join(', ') })}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      ))}

      <Button type="button" size="sm" className="w-fit" disabled={!dirty || saving} onClick={handleSave}>
        {t('common.save')}
      </Button>
    </div>
  )
}
