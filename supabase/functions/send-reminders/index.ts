// Supabase Edge Function: send weekly reminder push notifications.
// Deploy: supabase functions deploy send-reminders
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Optional: APP_BASE_URL, STUDENT_APP_URL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Rule = {
  id: string
  user_id: string
  weekday: number
  time_of_day: string
  timezone: string
  label: string
  class_id: string | null
  enabled: boolean
}

function localParts(timeZone: string, date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  )
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return {
    weekday: weekdayMap[parts.weekday] ?? 0,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

function ruleMinutes(timeOfDay: string) {
  const [h, m] = timeOfDay.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function withTrailingSlash(url: string) {
  return url.endsWith('/') ? url : `${url}/`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')!
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com'
    const teacherBase = withTrailingSlash(
      Deno.env.get('APP_BASE_URL') || '/homework-tracker/',
    )
    const studentBase = withTrailingSlash(
      Deno.env.get('STUDENT_APP_URL') || `${teacherBase}student/`,
    )

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: rules, error } = await admin
      .from('reminder_rules')
      .select('*')
      .eq('enabled', true)
    if (error) throw error

    let sent = 0
    let skipped = 0

    for (const rule of (rules ?? []) as Rule[]) {
      const tz = rule.timezone || 'Asia/Hong_Kong'
      const local = localParts(tz)
      if (local.weekday !== rule.weekday) {
        skipped += 1
        continue
      }
      const target = ruleMinutes(String(rule.time_of_day))
      const diff = local.minutes - target
      // Match if within the last 5 minutes window
      if (diff < 0 || diff >= 5) {
        skipped += 1
        continue
      }

      const { data: existing } = await admin
        .from('notification_log')
        .select('id')
        .eq('rule_id', rule.id)
        .eq('occurrence_date', local.date)
        .maybeSingle()
      if (existing) {
        skipped += 1
        continue
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('id, school_id')
        .eq('id', rule.user_id)
        .maybeSingle()

      let title = rule.label || '功課提醒'
      let body = '請開啟 App 查看詳情'
      let url = teacherBase

      if (profile) {
        // Teacher: count distinct students with missing submissions in school scope
        let classQuery = admin
          .from('classes')
          .select('id, name')
          .eq('school_id', profile.school_id)
        if (rule.class_id) classQuery = classQuery.eq('id', rule.class_id)
        const { data: classes } = await classQuery
        const classIds = (classes ?? []).map((c) => c.id as string)
        const className =
          rule.class_id
            ? ((classes ?? []).find((c) => c.id === rule.class_id)?.name as string) ||
              '該班'
            : null

        let missingStudentCount = 0
        if (classIds.length) {
          const { data: assignments } = await admin
            .from('assignments')
            .select('id')
            .in('class_id', classIds)
          const aIds = (assignments ?? []).map((a) => a.id as string)
          if (aIds.length) {
            const { data: missingRows } = await admin
              .from('submissions')
              .select('student_id')
              .in('assignment_id', aIds)
              .eq('status', 'missing')
            const unique = new Set(
              (missingRows ?? []).map((r) => r.student_id as string),
            )
            missingStudentCount = unique.size
          }
        }

        if (className) {
          body = `「${className}」現有 ${missingStudentCount} 位學生欠交，記得追收。`
        } else {
          body = `全校現有 ${missingStudentCount} 位學生欠交。`
        }
        url = `${teacherBase}history`
      } else {
        // Student: own missing homework titles
        const { data: links } = await admin
          .from('student_links')
          .select('student_id')
          .eq('user_id', rule.user_id)
        const studentIds = (links ?? []).map((l) => l.student_id as string)
        let missingTitles: string[] = []
        if (studentIds.length) {
          const { data: subs } = await admin
            .from('submissions')
            .select('assignment_id, status, assignments(title)')
            .in('student_id', studentIds)
            .eq('status', 'missing')
            .limit(5)
          missingTitles = (subs ?? []).map((s) => {
            const a = s.assignments as unknown as
              | { title?: string }
              | { title?: string }[]
              | null
            const row = Array.isArray(a) ? a[0] : a
            return row?.title || '功課'
          })
        }
        if (missingTitles.length) {
          body = `你還欠交：${missingTitles.join('、')}`
        } else {
          body = '目前沒有欠交功課，繼續保持！'
        }
        url = studentBase
      }

      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', rule.user_id)

      let ok = false
      let lastError: string | null = null
      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint as string,
              keys: {
                p256dh: sub.p256dh as string,
                auth: sub.auth_key as string,
              },
            },
            JSON.stringify({ title, body, url }),
          )
          ok = true
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode
          lastError = err instanceof Error ? err.message : String(err)
          if (statusCode === 404 || statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('id', sub.id)
          }
        }
      }

      await admin.from('notification_log').insert({
        rule_id: rule.id,
        user_id: rule.user_id,
        occurrence_date: local.date,
        status: ok ? 'sent' : 'failed',
        error: ok ? null : lastError || 'no subscription',
      })
      if (ok) sent += 1
      else skipped += 1
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
