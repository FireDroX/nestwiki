import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityFeed } from '#components/Profile/ActivityFeed'
import { AvatarUploader } from '#components/Profile/AvatarUploader'
import { ChangePasswordForm } from '#components/Profile/ChangePasswordForm'
import { ProfileForm } from '#components/Profile/ProfileForm'
import { ProfileStats } from '#components/Profile/ProfileStats'
import { ProfileSummary } from '#components/Profile/ProfileSummary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#components/ui/tabs'
import { getMe } from '#api/users'
import type { AuthUser } from '#api/auth'
import { useAuth } from '#hooks/useAuth'
import { useDocumentTitle } from '#hooks/useDocumentTitle'
import { PAGE_PADDING } from '#utils/page-layout'
import { cn } from '#lib/utils'

export function Profile() {
  const { t } = useTranslation()
  const { refreshUser } = useAuth()
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useDocumentTitle(t('profile.title'))

  useEffect(() => {
    let cancelled = false

    getMe()
      .then((user) => {
        if (!cancelled) {
          setProfile(user)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  function handleUpdate(updated: AuthUser) {
    setProfile((current) => (current ? { ...current, ...updated } : updated))
    void refreshUser()
  }

  if (status === 'loading' || !profile) {
    return <div className={PAGE_PADDING} />
  }

  return (
    <div className={cn(PAGE_PADDING, 'mx-auto flex max-w-3xl flex-col gap-6')}>
      <Tabs defaultValue="profile" className="gap-6">
        <TabsList variant="line">
          <TabsTrigger value="profile">{t('profile.tabProfile')}</TabsTrigger>
          <TabsTrigger value="activity">{t('profile.tabActivity')}</TabsTrigger>
          <TabsTrigger value="security">{t('profile.tabSecurity')}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-5 rounded-lg border border-border bg-card p-4 sm:flex-row sm:gap-8 sm:p-6">
            <AvatarUploader user={profile} onUpdate={handleUpdate} />
            <ProfileSummary user={profile} />
          </div>

          <ProfileStats user={profile} />

          <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <ProfileForm user={profile} onUpdate={handleUpdate} />
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <ActivityFeed />
        </TabsContent>

        <TabsContent value="security">
          <ChangePasswordForm />
        </TabsContent>
      </Tabs>
    </div>
  )
}
