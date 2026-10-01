import { useEffect, useState } from 'react'
import { PageAccessTreeSelector, type InheritedAccessRule } from '#components/PageAccessTreeSelector/PageAccessTreeSelector'
import { getEffectivePermissions } from '#api/users'

interface UserAccessTabProps {
  userId: string
}

export function UserAccessTab({ userId }: UserAccessTabProps) {
  const [inheritedRules, setInheritedRules] = useState<InheritedAccessRule[]>([])

  useEffect(() => {
    getEffectivePermissions(userId)
      .then((explanation) => {
        const groupRules = explanation.accessRules
          .filter((rule) => rule.origin.type === 'group')
          .map((rule) => ({
            pageId: rule.pageId,
            appliesTo: rule.appliesTo,
            actions: rule.actions,
            excludedPageIds: rule.excludedPageIds,
            groupName: rule.origin.type === 'group' ? rule.origin.groupName : '',
          }))
        setInheritedRules(groupRules)
      })
      .catch(() => setInheritedRules([]))
  }, [userId])

  return <PageAccessTreeSelector subject={{ type: 'user', id: userId }} inheritedRules={inheritedRules} />
}
