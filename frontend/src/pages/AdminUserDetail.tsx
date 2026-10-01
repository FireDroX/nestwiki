import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AdminNav } from '#components/AdminNav'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#components/ui/tabs'
import { InfoTab } from '#components/AdminUsers/InfoTab'
import { UserGroupsTab } from '#components/AdminUsers/UserGroupsTab'
import { UserPermissionsTab } from '#components/AdminUsers/UserPermissionsTab'
import { UserAccessTab } from '#components/AdminUsers/UserAccessTab'
import { EffectivePermissionsTab } from '#components/AdminUsers/EffectivePermissionsTab'
import { getUserDetail, type AdminUserDetail as AdminUserDetailType } from '#api/users'

type Status = 'loading' | 'ready' | 'error'

export function AdminUserDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<AdminUserDetailType | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!id) return
    const userId = id
    let cancelled = false

    async function load() {
      setStatus('loading')
      try {
        const detail = await getUserDetail(userId)
        if (cancelled) return
        setUser(detail)
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

  return (
    <div className="p-8">
      <AdminNav />
      <div className="mt-5 mb-4">
        <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> {t('admin.users.backToList')}
        </Link>
      </div>

      {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {status === 'error' && <p className="text-sm text-destructive">{t('admin.users.loadError')}</p>}

      {status === 'ready' && user && id && (
        <>
          <h1 className="mb-4 text-xl font-semibold">{user.displayName}</h1>

          <Tabs defaultValue="info" className="gap-6">
            <TabsList variant="line">
              <TabsTrigger value="info">{t('admin.users.tabInfo')}</TabsTrigger>
              <TabsTrigger value="groups">{t('admin.groups.tabMembers')}</TabsTrigger>
              <TabsTrigger value="permissions">{t('admin.groups.tabPermissions')}</TabsTrigger>
              <TabsTrigger value="access">{t('admin.groups.tabAccess')}</TabsTrigger>
              <TabsTrigger value="effective">{t('admin.users.tabEffective')}</TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <InfoTab user={user} onUpdated={setUser} />
            </TabsContent>

            <TabsContent value="groups">
              <UserGroupsTab user={user} onUpdated={setUser} />
            </TabsContent>

            <TabsContent value="permissions">
              <UserPermissionsTab user={user} onUpdated={setUser} />
            </TabsContent>

            <TabsContent value="access">
              <UserAccessTab userId={id} />
            </TabsContent>

            <TabsContent value="effective">
              <EffectivePermissionsTab userId={id} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
