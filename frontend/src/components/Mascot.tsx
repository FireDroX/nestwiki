import { useTranslation } from 'react-i18next'
import { cn } from '#lib/utils'

interface MascotProps {
  className?: string
}

export function Mascot({ className }: MascotProps) {
  const { t } = useTranslation()
  return (
    <>
      <img
        src="/nestwiki-mascot-light.png"
        alt={t('common.mascotAlt')}
        width={600}
        height={761}
        className={cn('w-auto dark:hidden', className)}
      />
      <img
        src="/nestwiki-mascot-dark.png"
        alt={t('common.mascotAlt')}
        width={600}
        height={761}
        className={cn('hidden w-auto dark:block', className)}
      />
    </>
  )
}
