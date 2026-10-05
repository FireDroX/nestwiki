import type { ReactNode } from 'react'
import { Checkbox } from '#components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#components/ui/table'
import { DESKTOP_TABLE_QUERY, useMediaQuery } from '#hooks/useMediaQuery'
import { cn } from '#lib/utils'

export interface ResponsiveColumn<Row> {
  id: string
  header: ReactNode
  cell: (row: Row) => ReactNode
  primary?: boolean
  className?: string
}

export interface ResponsiveTableSelection<Row> {
  selectedKeys: string[]
  onSelectedChange: (keys: string[]) => void
  selectAllLabel: string
  selectRowLabel: (row: Row) => string
}

interface ResponsiveTableProps<Row> {
  columns: ResponsiveColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  rowClassName?: (row: Row) => string | undefined
  actions?: (row: Row) => ReactNode
  onRowClick?: (row: Row) => void
  selection?: ResponsiveTableSelection<Row>
  empty?: ReactNode
}

function useSelectionToggles<Row>(
  rows: Row[],
  rowKey: (row: Row) => string,
  selection: ResponsiveTableSelection<Row> | undefined,
) {
  const selectedSet = new Set(selection?.selectedKeys ?? [])
  const allSelected = rows.length > 0 && rows.every((row) => selectedSet.has(rowKey(row)))

  function toggleAll(checked: boolean) {
    selection?.onSelectedChange(checked ? rows.map(rowKey) : [])
  }

  function toggleOne(row: Row, checked: boolean) {
    const key = rowKey(row)
    const keys = selection?.selectedKeys ?? []
    selection?.onSelectedChange(checked ? [...keys, key] : keys.filter((selected) => selected !== key))
  }

  return { selectedSet, allSelected, toggleAll, toggleOne }
}

export function ResponsiveTable<Row>({
  columns,
  rows,
  rowKey,
  rowClassName,
  actions,
  onRowClick,
  selection,
  empty,
}: ResponsiveTableProps<Row>) {
  const isDesktop = useMediaQuery(DESKTOP_TABLE_QUERY)
  const { selectedSet, allSelected, toggleAll, toggleOne } = useSelectionToggles(rows, rowKey, selection)

  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }

  if (isDesktop) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {selection && (
              <TableHead className="w-10">
                <Checkbox
                  aria-label={selection.selectAllLabel}
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead key={column.id}>{column.header}</TableHead>
            ))}
            {actions && <TableHead className="w-px" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              className={cn(onRowClick && 'cursor-pointer', rowClassName?.(row))}
              onClick={onRowClick && (() => onRowClick(row))}
            >
              {selection && (
                <TableCell>
                  <Checkbox
                    aria-label={selection.selectRowLabel(row)}
                    checked={selectedSet.has(rowKey(row))}
                    onCheckedChange={(checked) => toggleOne(row, checked === true)}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell key={column.id} className={column.className}>
                  {column.cell(row)}
                </TableCell>
              ))}
              {actions && (
                <TableCell>
                  <div className="flex justify-end gap-1">{actions(row)}</div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  const primaryColumns = columns.filter((column) => column.primary)
  const detailColumns = columns.filter((column) => !column.primary)

  return (
    <div className="flex flex-col gap-3">
      {selection && rows.length > 0 && (
        <label className="flex min-h-10 items-center gap-3 px-3 text-sm text-muted-foreground">
          <Checkbox
            aria-label={selection.selectAllLabel}
            checked={allSelected}
            onCheckedChange={(checked) => toggleAll(checked === true)}
          />
          <span aria-hidden>{selection.selectAllLabel}</span>
        </label>
      )}
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn(
              'rounded-lg border border-border bg-card p-3 text-sm',
              onRowClick && 'cursor-pointer',
              rowClassName?.(row),
            )}
            onClick={onRowClick && (() => onRowClick(row))}
          >
            <div className="flex items-start gap-3">
              {selection && (
                <Checkbox
                  className="mt-0.5"
                  aria-label={selection.selectRowLabel(row)}
                  checked={selectedSet.has(rowKey(row))}
                  onCheckedChange={(checked) => toggleOne(row, checked === true)}
                />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                {primaryColumns.map((column) => (
                  <div key={column.id} className="min-w-0 font-medium">
                    {column.cell(row)}
                  </div>
                ))}
              </div>
            </div>
            {detailColumns.length > 0 && (
              <dl className="mt-3 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
                {detailColumns.map((column) => (
                  <div key={column.id} className="contents">
                    <dt className="text-muted-foreground">{column.header}</dt>
                    <dd className="min-w-0 break-words">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actions && (
              <div className="mt-3 flex justify-end gap-1 border-t border-border pt-2 [&_[data-slot=button]]:min-h-10 [&_[data-slot=button]]:min-w-10">
                {actions(row)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
