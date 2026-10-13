import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider } from 'next-themes'
import { App } from './App'
import { AuthProvider } from '#components/AuthProvider'
import { PageTreeProvider } from '#components/PageTreeProvider'
import { Toaster } from '#components/ui/sonner'
import { getSettings } from '#api/settings'
import i18n from '#lib/i18n'
import './index.css'

async function bootstrap() {
  try {
    const settings = await getSettings()
    if (settings.locale) {
      await i18n.changeLanguage(settings.locale)
    }
  } catch {
    // /settings unreachable (e.g. backend down) - keep the fallback language.
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider attribute="class" defaultTheme="dark" scriptProps={{ type: 'application/json' }}>
        <I18nextProvider i18n={i18n}>
          <BrowserRouter>
            <AuthProvider>
              <PageTreeProvider>
                <App />
                <Toaster />
              </PageTreeProvider>
            </AuthProvider>
          </BrowserRouter>
        </I18nextProvider>
      </ThemeProvider>
    </StrictMode>,
  )
}

void bootstrap()
