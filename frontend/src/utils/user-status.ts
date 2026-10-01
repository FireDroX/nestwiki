export function isUserLocked(user: { lockedUntil?: string | null }): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()
}
