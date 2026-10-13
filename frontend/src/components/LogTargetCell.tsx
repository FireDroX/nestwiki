import { Link } from 'react-router'

interface LogTargetCellProps {
  targetType: string
  targetId: string | null
  href: string | null
}

export function LogTargetCell({ targetType, targetId, href }: LogTargetCellProps) {
  const label = `${targetType}${targetId ? ` · ${targetId}` : ''}`
  if (!href) return label

  return (
    <Link
      to={href}
      className="underline-offset-4 hover:text-foreground hover:underline"
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Link>
  )
}
