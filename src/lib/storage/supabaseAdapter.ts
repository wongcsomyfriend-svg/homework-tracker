import type { SupabaseClient, User } from '@supabase/supabase-js'
import type {
  AppData,
  Assignment,
  ClassRoom,
  ScanSession,
  School,
  Student,
  Submission,
  SubmissionStatus,
} from '../types'
import type { StorageAdapter } from './adapter'
import { notifyDataChanged, subscribeData } from './notify'

type DbClass = {
  id: string
  school_id: string
  name: string
  school_year: string
  created_at: string
}

type DbStudent = {
  id: string
  class_id: string
  student_no: string
  name: string
  marker_id: number
}

type DbAssignment = {
  id: string
  class_id: string
  title: string
  subject: string
  due_date: string | null
  created_at: string
}

type DbSubmission = {
  id: string
  assignment_id: string
  student_id: string
  status: SubmissionStatus
  detected_at: string | null
  updated_at: string
}

type DbScanSession = {
  id: string
  assignment_id: string
  detected_ids: number[]
  created_at: string
}

function emptyCache(): AppData {
  return {
    school: { id: '', name: '我的學校' },
    classes: [],
    students: [],
    assignments: [],
    submissions: [],
    scanSessions: [],
  }
}

function normalizeStudentNo(studentNo: string) {
  return studentNo.trim()
}

function mapClass(row: DbClass): ClassRoom {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    schoolYear: row.school_year,
    createdAt: row.created_at,
  }
}

function mapStudent(row: DbStudent): Student {
  return {
    id: row.id,
    classId: row.class_id,
    studentNo: row.student_no,
    name: row.name,
    markerId: row.marker_id,
  }
}

function mapAssignment(row: DbAssignment): Assignment {
  return {
    id: row.id,
    classId: row.class_id,
    title: row.title,
    subject: row.subject || '一般',
    dueDate: row.due_date ?? new Date().toISOString().slice(0, 10),
    createdAt: row.created_at,
  }
}

function mapSubmission(row: DbSubmission): Submission {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    status: row.status,
    detectedAt: row.detected_at,
    updatedAt: row.updated_at,
  }
}

function mapScan(row: DbScanSession): ScanSession {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    detectedIds: Array.isArray(row.detected_ids) ? row.detected_ids : [],
    createdAt: row.created_at,
  }
}

function dbError(err: { message?: string } | null, fallback: string) {
  throw new Error(err?.message || fallback)
}

export function createSupabaseAdapter(client: SupabaseClient): StorageAdapter {
  let cache = emptyCache()
  let readyPromise: Promise<void> | null = null
  let user: User | null = null

  async function requireUser() {
    const { data, error } = await client.auth.getUser()
    if (error) dbError(error, '無法取得登入狀態')
    if (!data.user) throw new Error('請先登入後再使用雲端資料')
    user = data.user
    return data.user
  }

  async function requireSession() {
    await requireUser()
    if (!cache.school.id) {
      await refresh()
    }
    if (!cache.school.id) {
      throw new Error('請先登入後再使用雲端資料')
    }
  }

  async function ensureWorkspace() {
    const { data, error } = await client.rpc('ensure_my_workspace', {
      p_school_name: '我的學校',
    })
    if (error) dbError(error, '無法建立學校工作區')
    return data as string
  }

  async function refresh() {
    const { data: authData, error: authError } = await client.auth.getUser()
    if (authError) dbError(authError, '無法取得登入狀態')
    if (!authData.user) {
      user = null
      cache = emptyCache()
      notifyDataChanged()
      return
    }
    user = authData.user
    await ensureWorkspace()

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('school_id, schools(id, name)')
      .eq('id', user.id)
      .single()
    if (profileError || !profile) {
      dbError(profileError, '無法讀取個人資料')
    }
    const profileRow = profile!

    const schoolJoin = profileRow.schools as unknown as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null
    const schoolRow = Array.isArray(schoolJoin) ? schoolJoin[0] : schoolJoin
    const school: School = {
      id: profileRow.school_id as string,
      name: schoolRow?.name ?? '我的學校',
    }

    const { data: classes, error: classError } = await client
      .from('classes')
      .select('*')
      .eq('school_id', school.id)
      .order('created_at', { ascending: false })
    if (classError) dbError(classError, '無法讀取班別')

    const classIds = (classes ?? []).map((c) => c.id)
    let students: DbStudent[] = []
    let assignments: DbAssignment[] = []
    let submissions: DbSubmission[] = []
    let sessions: DbScanSession[] = []

    if (classIds.length) {
      const sRes = await client.from('students').select('*').in('class_id', classIds)
      if (sRes.error) dbError(sRes.error, '無法讀取學生')
      students = (sRes.data ?? []) as DbStudent[]

      const aRes = await client
        .from('assignments')
        .select('*')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })
      if (aRes.error) dbError(aRes.error, '無法讀取功課')
      assignments = (aRes.data ?? []) as DbAssignment[]

      const assignmentIds = assignments.map((a) => a.id)
      if (assignmentIds.length) {
        const subRes = await client
          .from('submissions')
          .select('*')
          .in('assignment_id', assignmentIds)
        if (subRes.error) dbError(subRes.error, '無法讀取提交紀錄')
        submissions = (subRes.data ?? []) as DbSubmission[]

        const scanRes = await client
          .from('scan_sessions')
          .select('*')
          .in('assignment_id', assignmentIds)
          .order('created_at', { ascending: false })
        if (scanRes.error) dbError(scanRes.error, '無法讀取掃描紀錄')
        sessions = (scanRes.data ?? []) as DbScanSession[]
      }
    }

    cache = {
      school,
      classes: (classes as DbClass[]).map(mapClass),
      students: students.map(mapStudent),
      assignments: assignments.map(mapAssignment),
      submissions: submissions.map(mapSubmission),
      scanSessions: sessions.map(mapScan),
    }
    notifyDataChanged()
  }

  return {
    driver: 'supabase',

    ready() {
      if (!readyPromise) {
        readyPromise = (async () => {
          await refresh()
          client.auth.onAuthStateChange(() => {
            readyPromise = refresh().catch((err) => {
              readyPromise = null
              throw err
            })
          })
        })().catch((err) => {
          readyPromise = null
          throw err
        })
      }
      return readyPromise
    },

    getData() {
      return cache
    },

    subscribe: subscribeData,

    async updateSchoolName(name: string) {
      await this.ready()
      await requireSession()
      const next = name.trim() || cache.school.name
      const { error } = await client
        .from('schools')
        .update({ name: next })
        .eq('id', cache.school.id)
      if (error) dbError(error, '無法更新學校名稱')
      cache = { ...cache, school: { ...cache.school, name: next } }
      notifyDataChanged()
    },

    async createClass(name, schoolYear) {
      await this.ready()
      await requireSession()
      const { data, error } = await client
        .from('classes')
        .insert({
          school_id: cache.school.id,
          name: name.trim(),
          school_year:
            schoolYear.trim() || new Date().getFullYear().toString(),
        })
        .select('*')
        .single()
      if (error) dbError(error, '無法建立班別')
      const room = mapClass(data as DbClass)
      cache = { ...cache, classes: [room, ...cache.classes] }
      notifyDataChanged()
      return room
    },

    async deleteClass(classId) {
      await this.ready()
      await requireSession()
      const { error } = await client.from('classes').delete().eq('id', classId)
      if (error) dbError(error, '無法刪除班別')
      await refresh()
    },

    getClass(classId) {
      return cache.classes.find((c) => c.id === classId)
    },

    getStudents(classId) {
      return cache.students
        .filter((s) => s.classId === classId)
        .sort((a, b) => a.markerId - b.markerId)
    },

    findStudentNoConflict(classId, studentNo, excludeStudentId) {
      const normalized = normalizeStudentNo(studentNo)
      if (!normalized) return null
      return (
        cache.students.find(
          (s) =>
            s.classId === classId &&
            s.id !== excludeStudentId &&
            normalizeStudentNo(s.studentNo) === normalized,
        ) ?? null
      )
    },

    async importStudents(classId, rows) {
      await this.ready()
      await requireSession()
      if (!classId) throw new Error('缺少班別 ID')
      const cleaned = rows
        .map((row) => ({
          studentNo: normalizeStudentNo(String(row.studentNo ?? '')),
          name: String(row.name ?? '').trim(),
        }))
        .filter((row) => row.studentNo && row.name)
      if (!cleaned.length) throw new Error('沒有有效的學生列')

      const seen = new Set<string>()
      for (const row of cleaned) {
        if (seen.has(row.studentNo)) {
          throw new Error(`學號「${row.studentNo}」重複，請修改後再匯入`)
        }
        seen.add(row.studentNo)
      }

      const { error: delError } = await client
        .from('students')
        .delete()
        .eq('class_id', classId)
      if (delError) dbError(delError, '無法清除舊名單')

      const payload = cleaned.slice(0, 50).map((row, index) => ({
        class_id: classId,
        student_no: row.studentNo,
        name: row.name,
        marker_id: index,
      }))
      const { data, error } = await client
        .from('students')
        .insert(payload)
        .select('*')
      if (error) dbError(error, '無法匯入學生')
      await refresh()
      return (data as DbStudent[]).map(mapStudent)
    },

    async addStudent(classId, studentNo, name) {
      await this.ready()
      await requireSession()
      const existing = cache.students.filter((s) => s.classId === classId)
      if (existing.length >= 50) throw new Error('每班最多 50 人')
      const no = normalizeStudentNo(studentNo)
      if (!no) throw new Error('請填寫學號')
      if (existing.some((s) => normalizeStudentNo(s.studentNo) === no)) {
        throw new Error(`學號「${no}」已存在，請使用其他學號`)
      }
      const used = new Set(existing.map((s) => s.markerId))
      let markerId = 0
      while (used.has(markerId) && markerId < 50) markerId += 1

      const { data, error } = await client
        .from('students')
        .insert({
          class_id: classId,
          student_no: no,
          name: name.trim(),
          marker_id: markerId,
        })
        .select('*')
        .single()
      if (error) {
        if (error.message?.includes('students_class_id_student_no_key')) {
          throw new Error(`學號「${no}」已存在，請使用其他學號`)
        }
        dbError(error, '無法新增學生')
      }
      const student = mapStudent(data as DbStudent)
      cache = { ...cache, students: [...cache.students, student] }
      notifyDataChanged()
      return student
    },

    async updateStudent(studentId, patch) {
      await this.ready()
      await requireSession()
      const student = cache.students.find((s) => s.id === studentId)
      if (!student) throw new Error('找不到學生')
      const updates: { student_no?: string; name?: string } = {}
      if (patch.studentNo !== undefined) {
        const no = normalizeStudentNo(patch.studentNo)
        if (!no) throw new Error('學號不能留空')
        const conflict = cache.students.find(
          (s) =>
            s.classId === student.classId &&
            s.id !== studentId &&
            normalizeStudentNo(s.studentNo) === no,
        )
        if (conflict) {
          throw new Error(
            `學號「${no}」已存在（${conflict.name}），請使用其他學號`,
          )
        }
        updates.student_no = no
      }
      if (patch.name !== undefined) updates.name = patch.name.trim()

      const { data, error } = await client
        .from('students')
        .update(updates)
        .eq('id', studentId)
        .select('*')
        .single()
      if (error) dbError(error, '無法更新學生')
      const next = mapStudent(data as DbStudent)
      cache = {
        ...cache,
        students: cache.students.map((s) => (s.id === studentId ? next : s)),
      }
      notifyDataChanged()
      return next
    },

    async removeStudent(studentId) {
      await this.ready()
      await requireSession()
      const { error } = await client.from('students').delete().eq('id', studentId)
      if (error) dbError(error, '無法刪除學生')
      cache = {
        ...cache,
        students: cache.students.filter((s) => s.id !== studentId),
        submissions: cache.submissions.filter((s) => s.studentId !== studentId),
      }
      notifyDataChanged()
    },

    async reassignMarkerIds(classId) {
      await this.ready()
      await requireSession()
      const list = cache.students
        .filter((s) => s.classId === classId)
        .sort((a, b) => {
          const na = Number(a.studentNo)
          const nb = Number(b.studentNo)
          if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
          return a.studentNo.localeCompare(b.studentNo, 'zh-Hant')
        })
      for (let i = 0; i < list.length; i++) {
        const { error } = await client
          .from('students')
          .update({ marker_id: i })
          .eq('id', list[i].id)
        if (error) dbError(error, '無法重排 Marker ID')
      }
      await refresh()
    },

    async createAssignment(classId, title, subject, dueDate) {
      await this.ready()
      await requireSession()
      const { data: auth } = await client.auth.getUser()
      const { data, error } = await client
        .from('assignments')
        .insert({
          class_id: classId,
          title: title.trim(),
          subject: subject.trim() || '一般',
          due_date: dueDate || new Date().toISOString().slice(0, 10),
          created_by: auth.user?.id ?? null,
        })
        .select('*')
        .single()
      if (error) dbError(error, '無法建立功課')
      const assignment = mapAssignment(data as DbAssignment)
      cache = { ...cache, assignments: [assignment, ...cache.assignments] }
      notifyDataChanged()
      return assignment
    },

    async deleteAssignment(assignmentId) {
      await this.ready()
      await requireSession()
      const { error } = await client
        .from('assignments')
        .delete()
        .eq('id', assignmentId)
      if (error) dbError(error, '無法刪除功課')
      cache = {
        ...cache,
        assignments: cache.assignments.filter((a) => a.id !== assignmentId),
        submissions: cache.submissions.filter(
          (s) => s.assignmentId !== assignmentId,
        ),
        scanSessions: cache.scanSessions.filter(
          (s) => s.assignmentId !== assignmentId,
        ),
      }
      notifyDataChanged()
    },

    getAssignments(classId) {
      return classId
        ? cache.assignments.filter((a) => a.classId === classId)
        : cache.assignments
    },

    getAssignment(assignmentId) {
      return cache.assignments.find((a) => a.id === assignmentId)
    },

    async saveScanResult(input) {
      await this.ready()
      await requireSession()
      const now = new Date().toISOString()
      const assignment = cache.assignments.find(
        (a) => a.id === input.assignmentId,
      )
      if (!assignment) throw new Error('找不到功課項目')

      const { data: sessionRow, error: sessionError } = await client
        .from('scan_sessions')
        .insert({
          assignment_id: input.assignmentId,
          detected_ids: [...input.detectedIds].sort((a, b) => a - b),
        })
        .select('*')
        .single()
      if (sessionError) dbError(sessionError, '無法儲存掃描紀錄')

      const { error: delError } = await client
        .from('submissions')
        .delete()
        .eq('assignment_id', input.assignmentId)
      if (delError) dbError(delError, '無法更新提交紀錄')

      const classStudents = cache.students.filter(
        (s) => s.classId === assignment.classId,
      )
      const rows = classStudents.map((student) => {
        const status = input.statuses[student.id] ?? 'missing'
        return {
          assignment_id: input.assignmentId,
          student_id: student.id,
          status,
          detected_at: status === 'submitted' ? now : null,
          updated_at: now,
        }
      })
      if (rows.length) {
        const { error } = await client.from('submissions').insert(rows)
        if (error) dbError(error, '無法寫入提交狀態')
      }

      await refresh()
      return mapScan(sessionRow as DbScanSession)
    },

    getSubmissions(assignmentId) {
      return cache.submissions.filter((s) => s.assignmentId === assignmentId)
    },

    getStudentMissingCounts(classId) {
      const studentIds = new Set(
        cache.students.filter((s) => s.classId === classId).map((s) => s.id),
      )
      const assignmentIds = new Set(
        cache.assignments.filter((a) => a.classId === classId).map((a) => a.id),
      )
      const counts = new Map<string, number>()
      for (const sub of cache.submissions) {
        if (
          !assignmentIds.has(sub.assignmentId) ||
          !studentIds.has(sub.studentId)
        ) {
          continue
        }
        if (sub.status === 'missing') {
          counts.set(sub.studentId, (counts.get(sub.studentId) ?? 0) + 1)
        }
      }
      return counts
    },

    async exportJson() {
      await this.ready()
      return JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          driver: 'supabase',
          data: cache,
        },
        null,
        2,
      )
    },

    async importJson(json: string) {
      await this.ready()
      await requireSession()
      const parsed = JSON.parse(json) as {
        data?: AppData
        school?: School
        classes?: ClassRoom[]
      }
      const data = parsed.data
      if (!data?.classes || !data.students) {
        throw new Error('匯入檔案缺少班別或學生資料')
      }

      // Replace cloud workspace content for this school with imported snapshot.
      const classIds = cache.classes.map((c) => c.id)
      if (classIds.length) {
        const { error } = await client.from('classes').delete().in('id', classIds)
        if (error) dbError(error, '無法清除雲端舊資料')
      }

      const idMap = new Map<string, string>()

      for (const room of data.classes) {
        const { data: created, error } = await client
          .from('classes')
          .insert({
            school_id: cache.school.id,
            name: room.name,
            school_year: room.schoolYear,
          })
          .select('*')
          .single()
        if (error) dbError(error, `無法匯入班別 ${room.name}`)
        idMap.set(room.id, (created as DbClass).id)
      }

      const studentRows = data.students
        .map((s) => {
          const classId = idMap.get(s.classId)
          if (!classId) return null
          return {
            class_id: classId,
            student_no: s.studentNo,
            name: s.name,
            marker_id: s.markerId,
            _oldId: s.id,
          }
        })
        .filter(Boolean) as Array<{
        class_id: string
        student_no: string
        name: string
        marker_id: number
        _oldId: string
      }>

      const studentIdMap = new Map<string, string>()
      if (studentRows.length) {
        for (const row of studentRows) {
          const { _oldId, ...insertRow } = row
          const { data: created, error } = await client
            .from('students')
            .insert(insertRow)
            .select('*')
            .single()
          if (error) dbError(error, `無法匯入學生 ${row.student_no}`)
          studentIdMap.set(_oldId, (created as DbStudent).id)
        }
      }

      const assignmentIdMap = new Map<string, string>()
      for (const a of data.assignments ?? []) {
        const classId = idMap.get(a.classId)
        if (!classId) continue
        const { data: created, error } = await client
          .from('assignments')
          .insert({
            class_id: classId,
            title: a.title,
            subject: a.subject,
            due_date: a.dueDate,
          })
          .select('*')
          .single()
        if (error) dbError(error, `無法匯入功課 ${a.title}`)
        assignmentIdMap.set(a.id, (created as DbAssignment).id)
      }

      for (const s of data.submissions ?? []) {
        const assignmentId = assignmentIdMap.get(s.assignmentId)
        const studentId = studentIdMap.get(s.studentId)
        if (!assignmentId || !studentId) continue
        const { error } = await client.from('submissions').insert({
          assignment_id: assignmentId,
          student_id: studentId,
          status: s.status,
          detected_at: s.detectedAt,
          updated_at: s.updatedAt,
        })
        if (error) dbError(error, '無法匯入提交紀錄')
      }

      for (const session of data.scanSessions ?? []) {
        const assignmentId = assignmentIdMap.get(session.assignmentId)
        if (!assignmentId) continue
        const { error } = await client.from('scan_sessions').insert({
          assignment_id: assignmentId,
          detected_ids: session.detectedIds,
        })
        if (error) dbError(error, '無法匯入掃描紀錄')
      }

      if (data.school?.name) {
        await client
          .from('schools')
          .update({ name: data.school.name })
          .eq('id', cache.school.id)
      }

      await refresh()
    },
  }
}
