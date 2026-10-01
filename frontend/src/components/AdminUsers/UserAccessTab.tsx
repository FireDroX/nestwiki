import { useEffect, useState } from 'react'
import { PageAccessTreeSelector, type InheritedAccessRule } from '#components/PageAccessTreeSelector/PageAccessTreeSelector'
import { getEffectivePermissions, type EffectiveAccessRule } from '#api/users'

interface UserAccessTabProps {
  userId: string
}

function hasGroupOrigin(
  rule: EffectiveAccessRule,
): rule is EffectiveAccessRule & { origin: { type: 'group'; groupId: string; groupName: string } } {
  return rule.origin.type === 'group'
}

export function UserAccessTab({ userId }: UserAccessTabProps) {
  const [inheritedRules, setInheritedRules] = useState<InheritedAccessRule[]>([])

  useEffect(() => {
    getEffectivePermissions(userId)
      .then((explanation) => {
        const groupRules = explanation.accessRules.filter(hasGroupOrigin).map((rule) => ({
          pageId: rule.pageId,
          appliesTo: rule.appliesTo,
          actions: rule.actions,
          excludedPageIds: rule.excludedPageIds,
          groupName: rule.origin.groupName,
        }))
        setInheritedRules(groupRules)
      })
      .catch(() => setInheritedRules([]))
  }, [userId])

  return <PageAccessTreeSelector subject={{ type: 'user', id: userId }} inheritedRules={inheritedRules} />
}
