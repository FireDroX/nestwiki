import { usePersistedCollapsed } from '#hooks/usePersistedCollapsed'

export const SIDEBAR_COLLAPSED_KEY = 'nestwiki:sidebar-collapsed'

export function useSidebarCollapsed() {
  return usePersistedCollapsed(SIDEBAR_COLLAPSED_KEY)
}
