import { Skeleton } from '#components/ui/skeleton'
import { PAGE_PADDING } from '#utils/page-layout'
import { cn } from '#lib/utils'
import { useSidebarCollapsed } from '#hooks/useSidebarCollapsed'

export function AppLayoutSkeleton() {
  const { collapsed } = useSidebarCollapsed()

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-14 w-full shrink-0 items-center gap-3 border-b border-border bg-background px-4">
        <Skeleton className="h-9 w-9 shrink-0 rounded-md md:hidden" />
        <Skeleton className="h-8 w-28 shrink-0" />
        <Skeleton className="h-9 w-full max-w-md rounded-md" />
        <Skeleton className="ml-auto h-9 w-9 shrink-0 rounded-full" />
      </header>
      <div className="flex min-h-0 flex-1">
        {collapsed ? (
          <aside className="hidden w-12 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-3 md:flex">
            <Skeleton className="h-9 w-9 rounded-md" />
          </aside>
        ) : (
          <aside className="hidden w-[280px] shrink-0 flex-col gap-2 border-r border-sidebar-border bg-sidebar p-3 md:flex">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-full" />
          </aside>
        )}
        <main className={cn(PAGE_PADDING, 'min-w-0 flex-1 overflow-y-auto')}>
          <Skeleton className="h-8 w-48" />
        </main>
      </div>
    </div>
  )
}
