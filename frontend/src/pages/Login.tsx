import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { isAxiosError } from 'axios'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { FormError } from '#components/FormError'
import { Mascot } from '#components/Mascot'
import { TurnstileWidget } from '#components/Turnstile'
import { Button } from '#components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '#components/ui/field'
import { Input } from '#components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#components/ui/tabs'
import { useAuth } from '#hooks/useAuth'
import { extractErrorMessage } from '#lib/api-errors'
import { createLoginSchema, createRegisterSchema, type LoginFormValues, type RegisterFormValues } from '#schemas/auth.schema'
import { sameOriginPath } from '#utils/safe-redirect'

function useLockoutCountdown() {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (secondsRemaining === null) return
    if (secondsRemaining <= 0) {
      setSecondsRemaining(null)
      return
    }
    const timer = setTimeout(() => setSecondsRemaining((s) => (s ?? 0) - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsRemaining])

  return { secondsRemaining, setSecondsRemaining }
}

function LoginForm({ redirectTo }: { redirectTo: string | null }) {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const { secondsRemaining: lockoutSeconds, setSecondsRemaining: setLockoutSeconds } = useLockoutCountdown()
  const schema = useMemo(() => createLoginSchema(t), [t])

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(data: LoginFormValues) {
    if (turnstileToken === null) return
    setSubmitError(null)
    setLockoutSeconds(null)
    try {
      await login({ ...data, turnstileToken })
      if (redirectTo) {
        window.location.assign(redirectTo)
        return
      }
      navigate('/', { replace: true })
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 423) {
        const retryAfter = Number(error.response.headers['retry-after'])
        setLockoutSeconds(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null)
      } else {
        setSubmitError(extractErrorMessage(error))
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="login-email">{t('auth.emailLabel')}</FieldLabel>
              <Input {...field} id="login-email" type="email" autoComplete="email" />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="login-password">{t('auth.passwordLabel')}</FieldLabel>
              <Input {...field} id="login-password" type="password" autoComplete="current-password" />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <TurnstileWidget onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
        {lockoutSeconds !== null ? (
          <p className="text-sm text-destructive">{t('auth.accountLocked', { seconds: lockoutSeconds })}</p>
        ) : (
          <FormError message={submitError} />
        )}
        <Button
          type="submit"
          disabled={isSubmitting || turnstileToken === null || lockoutSeconds !== null}
          className="w-full"
        >
          {t('auth.signIn')}
        </Button>
      </FieldGroup>
    </form>
  )
}

function RegisterForm() {
  const { t } = useTranslation()
  const { register } = useAuth()
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const schema = useMemo(() => createRegisterSchema(t), [t])

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', displayName: '' },
  })

  async function onSubmit(data: RegisterFormValues) {
    if (turnstileToken === null) return
    setSubmitError(null)
    try {
      await register({ ...data, turnstileToken })
      navigate('/', { replace: true })
    } catch (error) {
      setSubmitError(extractErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={control}
          name="displayName"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="register-display-name">{t('auth.displayNameLabel')}</FieldLabel>
              <Input {...field} id="register-display-name" autoComplete="name" />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="register-email">{t('auth.emailLabel')}</FieldLabel>
              <Input {...field} id="register-email" type="email" autoComplete="email" />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={!!fieldState.error}>
              <FieldLabel htmlFor="register-password">{t('auth.passwordLabel')}</FieldLabel>
              <Input {...field} id="register-password" type="password" autoComplete="new-password" />
              {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
            </Field>
          )}
        />
        <TurnstileWidget onVerify={setTurnstileToken} onExpire={() => setTurnstileToken(null)} />
        <FormError message={submitError} />
        <Button type="submit" disabled={isSubmitting || turnstileToken === null} className="w-full">
          {t('auth.createAccount')}
        </Button>
      </FieldGroup>
    </form>
  )
}

export function Login() {
  const { t } = useTranslation()
  const { status } = useAuth()
  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get('tab') === 'register' ? 'register' : 'login'
  const redirectTo = sameOriginPath(searchParams.get('redirect'))

  if (status === 'authenticated') {
    if (redirectTo) {
      window.location.assign(redirectTo)
      return null
    }
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <Link to="/" title={t('auth.backHome')} aria-label={t('auth.backHome')} className="mx-auto mb-4 block w-fit">
            <Mascot className="h-19" />
          </Link>
          <h1 className="text-2xl font-semibold">{t('common.appName')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.appTagline')}</p>
        </div>
        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full">
            <TabsTrigger value="login">{t('auth.loginTab')}</TabsTrigger>
            <TabsTrigger value="register">{t('auth.registerTab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="pt-4">
            <LoginForm redirectTo={redirectTo} />
          </TabsContent>
          <TabsContent value="register" className="pt-4">
            <RegisterForm />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
