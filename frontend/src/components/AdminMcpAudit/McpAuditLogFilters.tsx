import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#components/ui/select'
import { Input } from '#components/ui/input'
import type { McpApiKeySummary } from '#api/admin-mcp'

const ALL_KEYS_VALUE = 'all'

interface McpAuditLogFiltersProps {
  apiKeys: McpApiKeySummary[]
  apiKeyId: string | undefined
  dateFrom: string | undefined
  dateTo: string | undefined
  search: string | undefined
  onChange: (next: {
    apiKeyId?: string
    dateFrom?: string
    dateTo?: string
    search?: string
  }) => void
}

export function McpAuditLogFilters({
  apiKeys,
  apiKeyId,
  dateFrom,
  dateTo,
  search,
  onChange,
}: McpAuditLogFiltersProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
      <Select
        value={apiKeyId ?? ALL_KEYS_VALUE}
        onValueChange={(value) => onChange({ apiKeyId: value === ALL_KEYS_VALUE ? undefined : value })}
      >
        <SelectTrigger className="w-full lg:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_KEYS_VALUE}>{t('admin.mcpAudit.allKeys')}</SelectItem>
          {apiKeys.map((key) => (
            <SelectItem key={key.id} value={key.id}>
              {key.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        className="w-full lg:w-40"
        value={dateFrom ?? ''}
        onChange={(event) => onChange({ dateFrom: event.target.value || undefined })}
      />
      <Input
        type="date"
        className="w-full lg:w-40"
        value={dateTo ?? ''}
        onChange={(event) => onChange({ dateTo: event.target.value || undefined })}
      />
      <Input
        type="text"
        className="w-full lg:w-64"
        placeholder={t('admin.mcpAudit.searchPlaceholder')}
        value={search ?? ''}
        onChange={(event) => onChange({ search: event.target.value || undefined })}
      />
    </div>
  )
}
