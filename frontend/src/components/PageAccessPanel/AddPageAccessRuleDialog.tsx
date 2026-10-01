import { useState } from 'react'
import { Users, X } from 'lucide-react'
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
import { Checkbox } from '#components/ui/checkbox'
import { Field, FieldLabel } from '#components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { Avatar, AvatarFallback } from '#components/ui/avatar'
import { BeneficiaryPicker, type Beneficiary } from '#components/PageAccessPanel/BeneficiaryPicker'
import { SubtreeExclusionTree } from '#components/PageAccessPanel/SubtreeExclusionTree'
import { createPageAccessRule } from '#api/page-access-rules'
import { PAGE_ACTIONS, type PageAction } from '#api/permissions'
import type { PageAccessRuleScope } from '#api/access-rules'
import type { PageTreeNode } from '#api/pages'
import { toInitials } from '#utils/initials'
import { extractErrorMessage } from '#lib/api-errors'

interface AddPageAccessRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  pageNode: PageTreeNode | null
  availableActions: PageAction[]
  onCreated: () => void
}

export function AddPageAccessRuleDialog({
  open,
  onOpenChange,
  pageId,
  pageNode,
  availableActions,
  onCreated,
}: AddPageAccessRuleDialogProps) {
  const { t } = useTranslation()
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null)
  const [scope, setScope] = useState<PageAccessRuleScope>('page')
  const [actions, setActions] = useState<Set<PageAction>>(new Set(['page.read']))
  const [excludedPageIds, setExcludedPageIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setBeneficiary(null)
    setScope('page')
    setActions(new Set(['page.read']))
    setExcludedPageIds([])
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (!next) reset()
  }

  function toggleAction(action: PageAction, checked: boolean) {
    setActions((current) => {
      const next = new Set(current)
      if (checked) next.add(action)
      else next.delete(action)
      return next.size === 0 ? new Set(['page.read']) : next
    })
  }

  async function handleSubmit() {
    if (!beneficiary) return
    setSubmitting(true)
    try {
      await createPageAccessRule(pageId, {
        subject: { type: beneficiary.type, id: beneficiary.id },
        appliesTo: scope,
        actions: [...actions],
        excludedPageIds: scope === 'subtree' ? excludedPageIds : undefined,
      })
      onCreated()
      toast.success(t('pageAccessPanel.ruleCreated'))
      handleOpenChange(false)
    } catch (error) {
      toast.error(extractErrorMessage(error, t('pageAccessPanel.ruleCreateFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  const selectableActions = PAGE_ACTIONS.filter((action) => availableActions.includes(action))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pageAccessPanel.addRuleTitle')}</DialogTitle>
          <DialogDescription>{t('pageAccessPanel.addRuleDescription')}</DialogDescription>
        </DialogHeader>

        {!beneficiary && <BeneficiaryPicker onSelect={setBeneficiary} />}

        {beneficiary && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2">
                {beneficiary.type === 'group' ? (
                  <Users className="size-4 text-muted-foreground" />
                ) : (
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">{toInitials(beneficiary.name)}</AvatarFallback>
                  </Avatar>
                )}
                <span className="text-sm font-medium">{beneficiary.name}</span>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => setBeneficiary(null)}>
                <X />
                <span className="sr-only">{t('pageAccessPanel.changeBeneficiary')}</span>
              </Button>
            </div>

            <Field>
              <FieldLabel htmlFor="new-rule-scope">{t('pageAccessPanel.scopeLabel')}</FieldLabel>
              <Select value={scope} onValueChange={(value) => setScope(value as PageAccessRuleScope)}>
                <SelectTrigger id="new-rule-scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="page">{t('pageAccessPanel.scopePageOnly')}</SelectItem>
                  <SelectItem value="subtree">{t('pageAccessPanel.scopeSubtree')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t('pageAccessTree.actionsLabel')}</FieldLabel>
              <div className="flex flex-col gap-1.5">
                {selectableActions.map((action) => (
                  <label key={action} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={actions.has(action)}
                      onCheckedChange={(checked) => toggleAction(action, checked === true)}
                    />
                    {t(`permissions.labels.${action}`)}
                  </label>
                ))}
              </div>
            </Field>

            {scope === 'subtree' && pageNode && (
              <Field>
                <FieldLabel>{t('pageAccessPanel.excludeSubpagesLabel')}</FieldLabel>
                <SubtreeExclusionTree rootNode={pageNode} excludedPageIds={excludedPageIds} onChange={setExcludedPageIds} />
              </Field>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="button" disabled={!beneficiary || submitting} onClick={handleSubmit}>
            {t('pageAccessPanel.addRuleSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
