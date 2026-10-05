import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '#components/ui/button'
import { FollowedPagesCard } from '#components/Home/FollowedPagesCard'
import { PopularPagesCard } from '#components/Home/PopularPagesCard'
import { StatsGrid } from '#components/Home/StatsGrid'
import { getFollowedPages, getPopularPages, getPublicStats, getStats } from '#api/stats'
import type { DashboardStats, FollowedPage, PopularPage, PublicStats } from '#api/stats'
import { useAuth } from '#hooks/useAuth'
import { useDocumentTitle } from '#hooks/useDocumentTitle'

function VisitorHome() {
  const { t } = useTranslation()
  const [stats, setStats] = useState<PublicStats | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false

    getPublicStats()
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex flex-col gap-6 p-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-primary uppercase">{t('home.visitor.eyebrow')}</p>
        <h1 className="font-heading text-3xl font-bold">{t('common.appName')}</h1>
        <p className="max-w-2xl text-muted-foreground">{t('home.visitor.description')}</p>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{t('home.visitor.loadError')}</p>
      ) : (
        <StatsGrid stats={stats} compact />
      )}

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold">{t('home.visitor.ctaTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('home.visitor.ctaDescription')}</p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/login?tab=register">{t('home.visitor.createAccount')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/login">{t('home.visitor.signIn')}</Link>
            </Button>
          </div>
          <a
            href="https://github.com/FireDroX/nestwiki"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {t('home.visitor.selfHost')}
          </a>
        </div>
      </div>
    </main>
  )
}

export function Home() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [popularPages, setPopularPages] = useState<PopularPage[] | null>(null)
  const [followedPages, setFollowedPages] = useState<FollowedPage[] | null>(null)
  const [loadError, setLoadError] = useState(false)

  useDocumentTitle(status === 'authenticated' ? t('home.title') : t('common.appName'))

  useEffect(() => {
    if (status !== 'authenticated') return

    let cancelled = false

    Promise.all([getStats(), getPopularPages(), getFollowedPages()])
      .then(([statsResult, popularResult, followedResult]) => {
        if (cancelled) return
        setStats(statsResult)
        setPopularPages(popularResult)
        setFollowedPages(followedResult)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })

    return () => {
      cancelled = true
    }
  }, [status])

  if (status !== 'authenticated') {
    return <VisitorHome />
  }

  return (
    <main className="flex flex-col gap-6 p-8">
      <h1 className="font-heading text-2xl font-bold">{t('home.title')}</h1>

      {loadError ? (
        <p className="text-sm text-destructive">{t('home.loadError')}</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t('home.statistics')}</h2>
            <StatsGrid stats={stats} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PopularPagesCard pages={popularPages} />
            <FollowedPagesCard pages={followedPages} />
          </div>
        </>
      )}
    </main>
  )
}
