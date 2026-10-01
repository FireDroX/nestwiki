import { useEffect, useState } from 'react'
import { Plus, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '#components/ui/sheet'
import { PageAccessRuleRow } from '#components/PageAccessPanel/PageAccessRuleRow'
import { AddPageAccessRuleDialog } from '#components/PageAccessPanel/AddPageAccessRuleDialog'
import {
  deletePageAccessRule,
  listPageAccessRules,
  updatePageAccessRule,
  type PageAccessRule,
} from '#api/page-access-rules'
import type { PageAction } from '#api/permissions'
import { usePageTree } from '#hooks/usePageTree'
import { buildPagePath, findPathToNode } from '#utils/page-tree'
import { extractErrorMessage } from '#lib/api-errors'

interface PageAccessPanelProps {
  pageId: string
  availableActions: PageAction[]
}

type Status = 'loading' | 'ready' | 'error'

export function PageAccessPanel({ pageId, availableActions }: PageAccessPanelProps) {
  const { t } = useTranslation()
  const { tree } = usePageTree()
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [rules, setRules] = useState<PageAccessRule[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStatus('loading')
    listPageAccessRules(pageId)
      .then((result) => {
        if (cancelled) return
        setRules(result)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [open, pageId, reloadToken])

  function reload() {
    setReloadToken((token) => token + 1)
  }

  async function handleActionsChange(rule: PageAccessRule, actions: PageAction[]) {
    setPendingRuleId(rule.id)
    try {
      const updated = await updatePageAccessRule(pageId, rule.id, { actions })
      setRules((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('pageAccessPanel.updateFailed')))
    } finally {
      setPendingRuleId(null)
    }
  }

  async function handleDelete(rule: PageAccessRule) {
    setPendingRuleId(rule.id)
    try {
      await deletePageAccessRule(pageId, rule.id)
      setRules((current) => current.filter((item) => item.id !== rule.id))
      toast.success(t('pageAccessPanel.ruleDeleted'))
    } catch (error) {
      toast.error(extractErrorMessage(error, t('pageAccessPanel.deleteFailed')))
    } finally {
      setPendingRuleId(null)
    }
  }

  const pageNode = findPathToNode(tree, (node) => node.id === pageId)?.at(-1) ?? null
  const directRules = rules.filter((rule) => !rule.inherited)
  const inheritedRules = rules.filter((rule) => rule.inherited)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Shield /> {t('pageAccessPanel.trigger')}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t('pageAccessPanel.title')}</SheetTitle>
          <SheetDescription>{t('pageAccessPanel.description')}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-3 px-4">
          <Button type="button" size="sm" className="w-fit" onClick={() => setAddOpen(true)}>
            <Plus /> {t('pageAccessPanel.addRuleButton')}
          </Button>

          {status === 'loading' && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
          {status === 'error' && <p className="text-sm text-destructive">{t('pageAccessPanel.loadError')}</p>}

          {status === 'ready' && (
            <>
              {directRules.length === 0 && inheritedRules.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('pageAccessPanel.empty')}</p>
              )}

              {directRules.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('pageAccessPanel.directRules')}</p>
                  {directRules.map((rule) => (
                    <PageAccessRuleRow
                      key={rule.id}
                      rule={rule}
                      originPath={null}
                      availableActions={availableActions}
                      pending={pendingRuleId === rule.id}
                      onActionsChange={(actions) => handleActionsChange(rule, actions)}
                      onDelete={() => handleDelete(rule)}
                    />
                  ))}
                </div>
              )}

              {inheritedRules.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('pageAccessPanel.inheritedRules')}</p>
                  {inheritedRules.map((rule) => (
                    <PageAccessRuleRow
                      key={rule.id}
                      rule={rule}
                      originPath={rule.pageId ? buildPagePath(tree, rule.pageId) : null}
                      availableActions={availableActions}
                      pending={false}
                      onActionsChange={() => {}}
                      onDelete={() => {}}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>

      <AddPageAccessRuleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        pageId={pageId}
        pageNode={pageNode}
        availableActions={availableActions}
        onCreated={reload}
      />
    </Sheet>
  )
}
