import { usePersistedCollapsed } from '#hooks/usePersistedCollapsed'

export const EDITOR_PANEL_COLLAPSED_KEY = 'nestwiki:editor-panel-collapsed'

export function useEditorPanelCollapsed() {
  return usePersistedCollapsed(EDITOR_PANEL_COLLAPSED_KEY)
}
