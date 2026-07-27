import { getStorageDriver } from './storage/driver'
import { supabaseConfigured } from './supabase'

export function isCloudMode() {
  return getStorageDriver() === 'supabase' && supabaseConfigured
}

function ensureTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`
}

/** Absolute URL of the student PWA (with trailing slash). */
export function getStudentAppUrl() {
  const fromEnv = (import.meta.env.VITE_STUDENT_APP_URL as string | undefined)?.trim()
  if (fromEnv) {
    return ensureTrailingSlash(fromEnv)
  }

  const base = import.meta.env.BASE_URL
  const origin =
    typeof window !== 'undefined' ? window.location.origin : ''

  // Student build: BASE_URL already ends with /student/
  if (base.includes('/student')) {
    return `${origin}${ensureTrailingSlash(base)}`
  }

  return `${origin}${ensureTrailingSlash(base)}student/`
}

export function getStudentJoinUrl(code: string) {
  return `${getStudentAppUrl()}join?code=${encodeURIComponent(code)}`
}
