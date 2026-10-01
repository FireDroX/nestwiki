import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '#components/ui/avatar'
import { avatarRawUrl } from '#api/users'
import { useContributors } from '#hooks/useContributors'
import { toInitials } from '#utils/initials'

interface ContributorsListProps {
  pageId: string
}

export function ContributorsList({ pageId }: ContributorsListProps) {
  const { t } = useTranslation()
  const { contributors, status } = useContributors(pageId)

  if (status !== 'ready' || contributors.length === 0) {
    return null
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{t('contributors.title')}</h2>
      <AvatarGroup>
        {contributors.map((contributor) => (
          <Avatar key={contributor.id} title={contributor.displayName}>
            <AvatarImage
              src={contributor.hasAvatar ? avatarRawUrl(contributor.id) : undefined}
              alt={contributor.displayName}
            />
            <AvatarFallback>{toInitials(contributor.displayName)}</AvatarFallback>
          </Avatar>
        ))}
      </AvatarGroup>
    </section>
  )
}
