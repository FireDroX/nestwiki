import { useTranslation } from 'react-i18next'
import { Checkbox } from '#components/ui/checkbox'
import { WEBHOOK_EVENT_GROUPS, WEBHOOK_EVENTS, type WebhookEventName } from '#api/webhooks'

interface WebhookEventsPickerProps {
  value: WebhookEventName[]
  onChange: (events: WebhookEventName[]) => void
  disabled?: boolean
}

export function WebhookEventsPicker({ value, onChange, disabled = false }: WebhookEventsPickerProps) {
  const { t } = useTranslation()
  const selected = new Set(value)
  const allSelected = WEBHOOK_EVENTS.every((event) => selected.has(event))
  const someSelected = value.length > 0

  function toggle(event: WebhookEventName, checked: boolean) {
    const next = new Set(selected)
    if (checked) {
      next.add(event)
    } else {
      next.delete(event)
    }
    onChange(WEBHOOK_EVENTS.filter((candidate) => next.has(candidate)))
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 border-b border-border pb-2 text-sm font-medium">
        <Checkbox
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          disabled={disabled}
          onCheckedChange={() => onChange(allSelected ? [] : [...WEBHOOK_EVENTS])}
        />
        {t('admin.webhooks.form.selectAllEvents')}
      </label>
      {WEBHOOK_EVENT_GROUPS.map((group) => (
        <fieldset key={group.id} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-muted-foreground">
            {t(`admin.webhooks.eventGroups.${group.id}`)}
          </legend>
          {group.events.map((event) => (
            <label key={event} className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={selected.has(event)}
                disabled={disabled}
                onCheckedChange={(checked) => toggle(event, checked === true)}
              />
              <span className="min-w-0">
                {t(`admin.webhooks.events.${event}`)}{' '}
                <code className="font-mono text-xs break-all text-muted-foreground">{event}</code>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  )
}
