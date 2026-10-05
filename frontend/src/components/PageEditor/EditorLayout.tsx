import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '#components/ui/button'

interface EditorLayoutProps {
  backTo: string
  title: ReactNode
  actions: ReactNode
  sidebar: ReactNode
  children: ReactNode
}

export function EditorLayout({ backTo, title, actions, sidebar, children }: EditorLayoutProps) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-svh flex-col bg-background md:h-svh">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4 sm:px-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to={backTo}>
            <ArrowLeft />
            <span className="sr-only">{t('common.back')}</span>
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate font-heading text-base font-semibold">{title}</h1>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </header>
      <div className="flex flex-1 flex-col md:min-h-0 md:flex-row">
        <aside className="order-last w-full shrink-0 border-t border-border bg-muted/30 p-5 md:order-none md:h-full md:w-72 md:overflow-y-auto md:border-t-0 md:border-r">
          {sidebar}
        </aside>
        <main className="flex min-h-[70svh] min-w-0 flex-1 flex-col md:min-h-0">{children}</main>
      </div>
    </div>
  )
}
