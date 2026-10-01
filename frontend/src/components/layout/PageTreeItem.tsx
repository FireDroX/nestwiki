import { ChevronRight, File, Folder, FolderOpen, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#components/ui/collapsible'
import { cn } from '#lib/utils'
import type { PageTreeNode } from '#api/pages'

interface PageTreeItemProps {
  node: PageTreeNode
  parentPath: string[]
  activeId?: string
  isExpanded: (id: string) => boolean
  onToggle: (id: string) => void
}

export function PageTreeItem({ node, parentPath, activeId, isExpanded, onToggle }: PageTreeItemProps) {
  const { t } = useTranslation()
  const isActive = node.id === activeId
  const hasChildren = node.children.length > 0
  const fullPath = [...parentPath, node.slug]
  const expanded = hasChildren && isExpanded(node.id)
  const Icon = hasChildren ? (expanded ? FolderOpen : Folder) : File

  const row = (
    <div className="group flex items-center gap-0.5 pl-2">
      {hasChildren ? (
        <CollapsibleTrigger className="flex size-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent">
          <ChevronRight className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
          <span className="sr-only">{t('pageTree.toggle', { title: node.title })}</span>
        </CollapsibleTrigger>
      ) : (
        <span className="size-6 shrink-0" />
      )}
      <Link
        to={`/pages/${fullPath.join('/')}`}
        className={cn(
          'flex flex-1 items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{node.title}</span>
      </Link>
      {node.canCreateChild && (
        <Link
          to={`/new?parent=${node.id}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-sidebar-foreground opacity-0 hover:bg-sidebar-accent group-hover:opacity-100"
        >
          <Plus className="size-3.5" />
          <span className="sr-only">{t('pageTree.createChild', { title: node.title })}</span>
        </Link>
      )}
    </div>
  )

  if (!hasChildren) {
    return row
  }

  return (
    <Collapsible open={expanded} onOpenChange={() => onToggle(node.id)}>
      {row}
      <CollapsibleContent className="ml-3 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
        {node.children.map((child) => (
          <PageTreeItem
            key={child.id}
            node={child}
            parentPath={fullPath}
            activeId={activeId}
            isExpanded={isExpanded}
            onToggle={onToggle}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
