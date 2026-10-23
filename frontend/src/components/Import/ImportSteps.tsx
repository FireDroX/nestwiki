import { useTranslation } from 'react-i18next'
import { cn } from '#lib/utils'
import { IMPORT_STEPS, type ImportStep } from '#utils/import'


interface ImportStepsProps {
  current: ImportStep
}

export function ImportSteps({ current }: ImportStepsProps) {
  const { t } = useTranslation()
  const currentIndex = IMPORT_STEPS.indexOf(current)

  return (
    <ol className="grid grid-cols-4 gap-2 text-xs sm:text-sm">
      {IMPORT_STEPS.map((step, index) => (
        <li
          key={step}
          aria-current={step === current ? 'step' : undefined}
          className={cn(
            'flex min-w-0 flex-col gap-1 border-t-2 pt-2',
            index <= currentIndex ? 'border-primary text-foreground' : 'border-border text-muted-foreground',
          )}
        >
          <span className="font-medium">{index + 1}</span>
          <span className="truncate">{t(`import.steps.${step}`)}</span>
        </li>
      ))}
    </ol>
  )
}
