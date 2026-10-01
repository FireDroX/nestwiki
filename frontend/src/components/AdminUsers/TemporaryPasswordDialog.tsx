import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog'
import { Button } from '#components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '#components/ui/input-group'

interface TemporaryPasswordDialogProps {
  password: string | null
  onClose: () => void
}

export function TemporaryPasswordDialog({ password, onClose }: TemporaryPasswordDialogProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('admin.users.copyPasswordFailed'))
    }
  }

  return (
    <Dialog open={!!password} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.temporaryPasswordTitle')}</DialogTitle>
          <DialogDescription>{t('admin.users.temporaryPasswordDescription')}</DialogDescription>
        </DialogHeader>

        <InputGroup>
          <InputGroupInput readOnly value={password ?? ''} className="font-mono" />
          <InputGroupAddon align="inline-end">
            <Button type="button" variant="ghost" size="icon-sm" onClick={handleCopy}>
              {copied ? <Check /> : <Copy />}
              <span className="sr-only">{t('admin.users.copyPassword')}</span>
            </Button>
          </InputGroupAddon>
        </InputGroup>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" onClick={onClose}>
              {t('common.close')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
