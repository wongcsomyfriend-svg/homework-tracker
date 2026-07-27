import { supabase } from './supabase'

export type StudentIdentity = {
  studentId: string
  studentNo: string
  name: string
  classId: string
  className: string
  markerId: number
}

export type StudentAssignmentRow = {
  assignmentId: string
  title: string
  subject: string
  dueDate: string
  status: 'submitted' | 'missing' | 'late' | 'excused'
  updatedAt: string | null
}

function requireClient() {
  if (!supabase) throw new Error('此功能需要雲端模式')
  return supabase
}

export async function ensureAnonymousSession() {
  const client = requireClient()
  const { data: sessionData, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw new Error(sessionError.message)
  if (sessionData.session?.user) return sessionData.session.user

  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('匿名登入失敗')
  return data.user
}

export async function claimStudent(code: string) {
  const client = requireClient()
  await ensureAnonymousSession()
  const { data, error } = await client.rpc('claim_student', {
    p_code: code.trim(),
  })
  if (error) throw new Error(error.message)
  return data as {
    studentId: string
    studentNo: string
    name: string
    classId: string
    className: string
  }
}

export async function listMyIdentities(): Promise<StudentIdentity[]> {
  const client = requireClient()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) return []

  const { data: links, error: linkError } = await client
    .from('student_links')
    .select('student_id')
    .eq('user_id', auth.user.id)
  if (linkError) throw new Error(linkError.message)
  const ids = (links ?? []).map((l) => l.student_id as string)
  if (!ids.length) return []

  const { data: students, error } = await client
    .from('students')
    .select('id, student_no, name, marker_id, class_id, classes(id, name)')
    .in('id', ids)
  if (error) throw new Error(error.message)

  return (students ?? []).map((row) => {
    const cls = row.classes as unknown as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null
    const classRow = Array.isArray(cls) ? cls[0] : cls
    return {
      studentId: row.id as string,
      studentNo: row.student_no as string,
      name: row.name as string,
      classId: (classRow?.id ?? row.class_id) as string,
      className: classRow?.name ?? '',
      markerId: row.marker_id as number,
    }
  })
}

export async function getMyAssignments(
  studentId: string,
): Promise<StudentAssignmentRow[]> {
  const client = requireClient()
  const { data: student, error: studentError } = await client
    .from('students')
    .select('class_id')
    .eq('id', studentId)
    .single()
  if (studentError) throw new Error(studentError.message)

  const { data: assignments, error: aError } = await client
    .from('assignments')
    .select('id, title, subject, due_date, created_at')
    .eq('class_id', student.class_id)
    .order('due_date', { ascending: false })
  if (aError) throw new Error(aError.message)

  const ids = (assignments ?? []).map((a) => a.id as string)
  const statusMap = new Map<string, { status: string; updated_at: string }>()
  if (ids.length) {
    const { data: subs, error: sError } = await client
      .from('submissions')
      .select('assignment_id, status, updated_at')
      .eq('student_id', studentId)
      .in('assignment_id', ids)
    if (sError) throw new Error(sError.message)
    for (const s of subs ?? []) {
      statusMap.set(s.assignment_id as string, {
        status: s.status as string,
        updated_at: s.updated_at as string,
      })
    }
  }

  return (assignments ?? []).map((a) => {
    const sub = statusMap.get(a.id as string)
    return {
      assignmentId: a.id as string,
      title: a.title as string,
      subject: (a.subject as string) || '一般',
      dueDate: (a.due_date as string) ?? '',
      status: (sub?.status as StudentAssignmentRow['status']) ?? 'missing',
      updatedAt: sub?.updated_at ?? null,
    }
  })
}

export async function unlinkSelf(studentId: string) {
  const client = requireClient()
  const { error } = await client.rpc('unlink_student', {
    p_student_id: studentId,
    p_user_id: null,
  })
  if (error) throw new Error(error.message)
}
