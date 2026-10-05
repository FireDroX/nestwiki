import { useEffect, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { UserRole } from '#api/auth'
import { getVersionStatus, type VersionStatus } from '#api/admin-version'
import { useAuth } from '#hooks/useAuth'

export const DISMISSED_UPDATE_KEY = 'nestwiki:dismissed-update'

const UPDATE_TOAST_STYLE = {
  background: 'color-mix(in oklch, var(--destructive) 80%, black)',
  borderColor: 'color-mix(in oklch, var(--destructive) 80%, black)',
  color: 'white',
}

const UPDATE_TOAST_CLASS_NAMES = {
  description: '!text-white/85',
  actionButton: '!bg-white !font-semibold !text-neutral-900',
  cancelButton: '!bg-white/20 !text-white',
}

function readDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_UPDATE_KEY)
  } catch {
    return null
  }
}

function rememberDismissedVersion(version: string) {
  try {
    localStorage.setItem(DISMISSED_UPDATE_KEY, version)
  } catch {
    return
  }
}

export function showUpdateToast(status: VersionStatus, latest: string, t: TFunction) {
  toast.error(t('updateNotice.title', { latest }), {
    id: 'update-available',
    position: 'top-center',
    duration: Infinity,
    description: t('updateNotice.description', { current: status.currentVersion }),
    style: UPDATE_TOAST_STYLE,
    classNames: UPDATE_TOAST_CLASS_NAMES,
    action: status.releaseUrl
      ? {
          label: t('updateNotice.viewRelease'),
          onClick: () => window.open(status.releaseUrl!, '_blank', 'noopener,noreferrer'),
        }
      : undefined,
    cancel: {
      label: t('updateNotice.ignore'),
      onClick: () => rememberDismissedVersion(latest),
    },
  })
}

export function useUpdateNotification() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isAdmin = user?.role === UserRole.Admin
  const checkedForUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!isAdmin || !user || checkedForUserId.current === user.id) {
      return
    }
    checkedForUserId.current = user.id

    getVersionStatus()
      .then((status) => {
        const latest = status.latestVersion
        if (!status.updateAvailable || !latest || readDismissedVersion() === latest) {
          return
        }
        showUpdateToast(status, latest, t)
      })
      .catch(() => {})
  }, [isAdmin, user, t])
}
