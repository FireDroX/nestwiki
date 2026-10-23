import { useMemo, useState } from 'react'
import { FolderTree } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '#components/ui/command'
import { usePageTree } from '#hooks/usePageTree'
import { importableDestinations } from '#utils/import'

interface ImportDestinationPickerProps {
  value: string | null
  onChange: (parentId: string | null) => void
  canImportAtRoot: boolean
  disabled?: boolean
}

export function ImportDestinationPicker({ value, onChange, canImportAtRoot, disabled }: ImportDestinationPickerProps) {
  const { t } = useTranslation()
  const { tree } = usePageTree()
  const [open, setOpen] = useState(false)
  const options = useMemo(() => importableDestinations(tree), [tree])
  const selectedLabel = value
    ? (options.find((option) => option.id === value)?.label ?? t('import.file.chooseDestination'))
    : canImportAtRoot
      ? t('import.file.root')
      : t('import.file.chooseDestination')

  function select(parentId: string | null) {
    onChange(parentId)
    setOpen(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full min-w-0 justify-start"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <FolderTree />
        <span className="truncate">{selectedLabel}</span>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={t('import.file.chooseDestination')}
        className="left-4 right-4 w-auto max-w-none translate-x-0 sm:left-1/2 sm:right-auto sm:w-fit sm:max-w-[calc(100%-2rem)] sm:-translate-x-1/2"
      >
        <Command>
          <CommandInput placeholder={t('import.file.searchPage')} />
          <CommandList>
            <CommandEmpty>{t('import.file.noPageFound')}</CommandEmpty>
            <CommandGroup>
              {canImportAtRoot && (
                <CommandItem value={t('import.file.root')} onSelect={() => select(null)} className="whitespace-nowrap">
                  {t('import.file.root')}
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => select(option.id)}
                  className="whitespace-nowrap"
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
