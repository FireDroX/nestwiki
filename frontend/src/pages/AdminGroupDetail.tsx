import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#components/ui/tabs'
import { MembersTab } from '#components/AdminGroups/MembersTab'
import { GlobalPermissionsTab } from '#components/AdminGroups/GlobalPermissionsTab'
import { PageAccessTreeSelector } from '#components/PageAccessTreeSelector/PageAccessTreeSelector'
import { getGroupDetail, setGroupMembers, type GroupDetail } from '#api/groups'
import { setGlobalPermissions } from '#api/access-rules'
import type { GlobalPermission } from '#api/permissions'
import { PAGE_PADDING } from '#utils/page-layout'

type Status = 'loading' | 'ready' | 'error'

export function AdminGroupDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [status, setStatus] = useState<Status>('loading')
  const [membersPending, setMembersPending] = useState(false)

  useEffect(() => {
    if (!id) return
    const groupId = id
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const detail = await getGroupDetail(groupId)
        if (cancelled) return
        setGroup(detail)
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleMembersChange(userIds: string[]) {
    if (!id) return
    setMembersPending(true)
    try {
      await setGroupMembers(id, userIds)
      const detail = await getGroupDetail(id)
      setGroup(detail)
    } finally {
      setMembersPending(false)
    }
  }

  async function handlePermissionsSave(permissions: GlobalPermission[]) {
    if (!id) return
    await setGlobalPermissions({ type: 'group', id }, permissions)
    setGroup((current) => (current ? { ...current, permissions } : current))
  }

  return (
    <div className={PAGE_PADDING}>
      <AdminNav />
      <div className="mt-5 mb-4">
        <Link to="/admin/groups" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {t('admin.groups.backToList')}
        </Link>
      </div>

      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.groups.loadError')}</p>}

      {status === 'ready' && group && id && (
        <>
          <h1 className="mb-4 text-xl font-semibold">{group.name}</h1>

          <Tabs defaultValue="members" className="gap-6">
            <TabsList variant="line" className="max-w-full justify-start overflow-x-auto [scrollbar-width:none]">
              <TabsTrigger value="members">{t('admin.groups.tabMembers')}</TabsTrigger>
              <TabsTrigger value="permissions">{t('admin.groups.tabPermissions')}</TabsTrigger>
              <TabsTrigger value="access">{t('admin.groups.tabAccess')}</TabsTrigger>
            </TabsList>

            <TabsContent value="members">
              <MembersTab members={group.members} pending={membersPending} onChange={handleMembersChange} />
            </TabsContent>

            <TabsContent value="permissions">
              <GlobalPermissionsTab permissions={group.permissions} onSave={handlePermissionsSave} />
            </TabsContent>

            <TabsContent value="access">
              <PageAccessTreeSelector subject={{ type: 'group', id }} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
