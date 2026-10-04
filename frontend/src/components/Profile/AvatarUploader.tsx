import { useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '#components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#components/ui/alert-dialog'
import { Button } from '#components/ui/button'
import { avatarRawUrl, removeAvatar, uploadAvatar } from '#api/users'
import type { AuthUser } from '#api/auth'
import { extractErrorMessage } from '#lib/api-errors'
import { toInitials } from '#utils/initials'

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024

interface AvatarUploaderProps {
  user: AuthUser
  onUpdate: (updated: AuthUser) => void
}

export function AvatarUploader({ user, onUpdate }: AvatarUploaderProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error(t('profile.avatarInvalidType'))
      return
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      toast.error(t('profile.avatarTooLarge'))
      return
    }

    clearPreview()
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPendingFile(null)
    setPreviewUrl(null)
  }

  async function handleConfirmUpload() {
    if (!pendingFile) {
      return
    }
    setPending(true)
    try {
      const updated = await uploadAvatar(pendingFile)
      onUpdate(updated)
      clearPreview()
      toast.success(t('profile.avatarUploadSuccess'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('profile.avatarUploadFailed')))
    } finally {
      setPending(false)
    }
  }

  async function handleRemove() {
    setPending(true)
    try {
      const updated = await removeAvatar()
      onUpdate(updated)
      toast.success(t('profile.avatarRemoveSuccess'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('profile.avatarRemoveFailed')))
    } finally {
      setPending(false)
    }
  }

  const displayedAvatarUrl = previewUrl ?? (user.hasAvatar ? avatarRawUrl(user.id) : undefined)

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div className="relative">
        <Avatar className="size-40">
          <AvatarImage src={displayedAvatarUrl} alt={user.displayName} />
          <AvatarFallback className="text-4xl">{toInitials(user.displayName)}</AvatarFallback>
        </Avatar>
        {!pendingFile && (
          <button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            aria-label={t('profile.changePhoto')}
            className="absolute right-1 bottom-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Camera className="size-3.5" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_AVATAR_TYPES.join(',')}
        className="hidden"
        onChange={handleFileSelected}
      />

      {pendingFile ? (
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={handleConfirmUpload}>
            {t('profile.confirmUpload')}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={clearPreview}>
            {t('profile.cancelPreview')}
          </Button>
        </div>
      ) : (
        user.hasAvatar && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="link"
                className="h-auto p-0 text-xs text-muted-foreground"
                disabled={pending}
              >
                {t('profile.removePhoto')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('profile.removePhotoConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('profile.removePhotoConfirmDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleRemove}>
                  {t('profile.removePhoto')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      )}
    </div>
  )
}
