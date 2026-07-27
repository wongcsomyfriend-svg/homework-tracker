import { useEffect, useState } from 'react'
import { getStorageDriver } from '../lib/store'
import { supabase } from '../lib/supabase'

export type SessionRole = 'guest' | 'teacher' | 'needsOnboarding' | 'loading'

export function useSession() {
  const [role, setRole] = useState<SessionRole>('loading')
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      if (getStorageDriver() !== 'supabase' || !supabase) {
        if (!cancelled) {
          setRole('guest')
          setEmail(null)
          setUserId(null)
        }
        return
      }

      const { data } = await supabase.auth.getSession()
      const user = data.session?.user ?? null
      if (!user) {
        if (!cancelled) {
          setRole('guest')
          setEmail(null)
          setUserId(null)
        }
        return
      }

      setUserId(user.id)
      setEmail(user.email ?? null)

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .maybeSingle()

      if (!cancelled) {
        if (profile) setRole('teacher')
        else if (user.is_anonymous) setRole('guest')
        else setRole('needsOnboarding')
      }
    }

    void resolve()
    if (!supabase) return

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void resolve()
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  return { role, email, userId }
}
