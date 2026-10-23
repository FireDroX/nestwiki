import { useTranslation } from 'react-i18next'

interface ImportProgressProps {
  percent: number
}

export function ImportProgress({ percent }: ImportProgressProps) {
  const { t } = useTranslation()
  const uploaded = percent >= 100

  return (
    <div className="flex flex-col gap-3 py-6" role="status">
      <p className="text-sm">
        {uploaded ? t('import.progress.processing') : t('import.progress.uploading', { percent })}
      </p>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className={uploaded ? 'h-full w-full animate-pulse bg-primary' : 'h-full bg-primary transition-[width]'}
          style={uploaded ? undefined : { width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
