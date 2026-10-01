import { z } from 'zod'
import type { TFunction } from 'i18next'
import { UserRole } from '#api/auth'

const DISPLAY_NAME_MIN_LENGTH = 2
const DISPLAY_NAME_MAX_LENGTH = 100
const MIN_PASSWORD_LENGTH = 8
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/

export function createAdminCreateUserSchema(t: TFunction) {
  return z.object({
    email: z.string().regex(EMAIL_REGEX, t('auth.validation.emailInvalid')),
    displayName: z
      .string()
      .min(DISPLAY_NAME_MIN_LENGTH, t('auth.validation.displayNameMinLength', { count: DISPLAY_NAME_MIN_LENGTH }))
      .max(DISPLAY_NAME_MAX_LENGTH, t('auth.validation.displayNameMaxLength', { count: DISPLAY_NAME_MAX_LENGTH })),
    role: z.enum([UserRole.Admin, UserRole.Member]),
    password: z
      .union([
        z.literal(''),
        z
          .string()
          .min(MIN_PASSWORD_LENGTH, t('auth.validation.passwordMinLength', { count: MIN_PASSWORD_LENGTH }))
          .regex(PASSWORD_COMPLEXITY_REGEX, t('auth.validation.passwordComplexity')),
      ])
      .optional(),
  })
}

export function createAdminUpdateUserSchema(t: TFunction) {
  return z.object({
    email: z.string().regex(EMAIL_REGEX, t('auth.validation.emailInvalid')),
    displayName: z
      .string()
      .min(DISPLAY_NAME_MIN_LENGTH, t('auth.validation.displayNameMinLength', { count: DISPLAY_NAME_MIN_LENGTH }))
      .max(DISPLAY_NAME_MAX_LENGTH, t('auth.validation.displayNameMaxLength', { count: DISPLAY_NAME_MAX_LENGTH })),
    role: z.enum([UserRole.Admin, UserRole.Member]),
  })
}

export type AdminCreateUserFormValues = z.infer<ReturnType<typeof createAdminCreateUserSchema>>
export type AdminUpdateUserFormValues = z.infer<ReturnType<typeof createAdminUpdateUserSchema>>
