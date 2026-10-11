import { useState } from 'react'
import { Outlet } from 'react-router'
import { Sidebar } from '#components/layout/Sidebar'
import { Topbar } from '#components/layout/Topbar'

export function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="flex h-svh flex-col print:block print:h-auto">
      <Topbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
      <div className="flex min-h-0 flex-1 print:block">
        <Sidebar mobileOpen={mobileSidebarOpen} onMobileOpenChange={setMobileSidebarOpen} />
        <main className="relative min-w-0 flex-1 overflow-y-auto print:overflow-visible">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
