import { useState, type ReactNode } from 'react'
import type { VariantProps } from 'class-variance-authority'
import { useTranslation } from 'react-i18next'
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
import { Button, buttonVariants } from '#components/ui/button'

interface ConfirmActionButtonProps {
  label: ReactNode
  confirmTitle: ReactNode
  confirmDescription: ReactNode
  confirmLabel?: ReactNode
  variant?: VariantProps<typeof buttonVariants>['variant']
  disabled?: boolean
  disabledReason?: string
  onConfirm: () => Promise<void> | void
}

export function ConfirmActionButton({
  label,
  confirmTitle,
  confirmDescription,
  confirmLabel,
  variant = 'outline',
  disabled = false,
  disabledReason,
  onConfirm,
}: ConfirmActionButtonProps) {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)

  async function handleConfirm() {
    setPending(true)
    try {
      await onConfirm()
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="sm"
          disabled={disabled || pending}
          title={disabled ? disabledReason : undefined}
        >
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant={variant === 'destructive' ? 'destructive' : 'default'} onClick={handleConfirm}>
            {confirmLabel ?? label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
