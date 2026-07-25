import { uid } from './id'
import type {
  AppData,
  Assignment,
  ClassRoom,
  ScanSession,
  Student,
  SubmissionStatus,
} from './types'

const KEY = 'homework-tracker:v1'

function emptyData(): AppData {
  return {
    school: { id: uid('school'), name: '我的學校' },
    classes: [],
    students: [],
    assignments: [],
    submissions: [],
    scanSessions: [],
  }
}

function load(): AppData {
  const base = emptyData()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      school: parsed.school ?? base.school,
      classes: Array.isArray(parsed.classes) ? parsed.classes : [],
      students: Array.isArray(parsed.students) ? parsed.students : [],
      assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [],
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
      scanSessions: Array.isArray(parsed.scanSessions) ? parsed.scanSessions : [],
    }
  } catch {
    return base
  }
}

function save(data: AppData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '無法寫入本機儲存（localStorage）'
    throw new Error(message)
  }
  window.dispatchEvent(new CustomEvent('ht:data'))
}

export function getData(): AppData {
  return load()
}

export function subscribe(cb: () => void) {
  const handler = () => cb()
  window.addEventListener('ht:data', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('ht:data', handler)
    window.removeEventListener('storage', handler)
  }
}

export function updateSchoolName(name: string) {
  const data = load()
  data.school.name = name.trim() || data.school.name
  save(data)
}

export function createClass(name: string, schoolYear: string): ClassRoom {
  const data = load()
  const room: ClassRoom = {
    id: uid('class'),
    schoolId: data.school.id,
    name: name.trim(),
    schoolYear: schoolYear.trim() || new Date().getFullYear().toString(),
    createdAt: new Date().toISOString(),
  }
  data.classes.unshift(room)
  save(data)
  return room
}

export function deleteClass(classId: string) {
  const data = load()
  data.classes = data.classes.filter((c) => c.id !== classId)
  data.students = data.students.filter((s) => s.classId !== classId)
  const assignmentIds = new Set(
    data.assignments.filter((a) => a.classId === classId).map((a) => a.id),
  )
  data.assignments = data.assignments.filter((a) => a.classId !== classId)
  data.submissions = data.submissions.filter(
    (s) => !assignmentIds.has(s.assignmentId),
  )
  data.scanSessions = data.scanSessions.filter(
    (s) => !assignmentIds.has(s.assignmentId),
  )
  save(data)
}

export function getClass(classId: string) {
  return load().classes.find((c) => c.id === classId)
}

export function getStudents(classId: string) {
  return load()
    .students.filter((s) => s.classId === classId)
    .sort((a, b) => a.markerId - b.markerId)
}

export function importStudents(
  classId: string,
  rows: { studentNo: string; name: string }[],
): Student[] {
  if (!classId) throw new Error('缺少班別 ID')
  const cleaned = rows
    .map((row) => ({
      studentNo: String(row.studentNo ?? '').trim(),
      name: String(row.name ?? '').trim(),
    }))
    .filter((row) => row.studentNo && row.name)
  if (!cleaned.length) throw new Error('沒有有效的學生列')

  const data = load()
  data.students = data.students.filter((s) => s.classId !== classId)
  const created: Student[] = cleaned.slice(0, 50).map((row, index) => ({
    id: uid('stu'),
    classId,
    studentNo: row.studentNo,
    name: row.name,
    markerId: index,
  }))
  data.students.push(...created)
  save(data)
  return created
}

export function addStudent(
  classId: string,
  studentNo: string,
  name: string,
): Student {
  const data = load()
  const existing = data.students.filter((s) => s.classId === classId)
  if (existing.length >= 50) throw new Error('每班最多 50 人')
  const used = new Set(existing.map((s) => s.markerId))
  let markerId = 0
  while (used.has(markerId) && markerId < 50) markerId += 1
  const student: Student = {
    id: uid('stu'),
    classId,
    studentNo: studentNo.trim(),
    name: name.trim(),
    markerId,
  }
  data.students.push(student)
  save(data)
  return student
}

export function updateStudent(
  studentId: string,
  patch: { studentNo?: string; name?: string },
) {
  const data = load()
  const student = data.students.find((s) => s.id === studentId)
  if (!student) throw new Error('找不到學生')
  if (patch.studentNo !== undefined) student.studentNo = patch.studentNo.trim()
  if (patch.name !== undefined) student.name = patch.name.trim()
  save(data)
  return student
}

export function removeStudent(studentId: string) {
  const data = load()
  data.students = data.students.filter((s) => s.id !== studentId)
  data.submissions = data.submissions.filter((s) => s.studentId !== studentId)
  save(data)
}

export function reassignMarkerIds(classId: string) {
  const data = load()
  const list = data.students
    .filter((s) => s.classId === classId)
    .sort((a, b) => {
      const na = Number(a.studentNo)
      const nb = Number(b.studentNo)
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
      return a.studentNo.localeCompare(b.studentNo, 'zh-Hant')
    })
  list.forEach((s, index) => {
    s.markerId = index
  })
  save(data)
}

export function createAssignment(
  classId: string,
  title: string,
  subject: string,
  dueDate: string,
): Assignment {
  const data = load()
  const assignment: Assignment = {
    id: uid('asg'),
    classId,
    title: title.trim(),
    subject: subject.trim() || '一般',
    dueDate: dueDate || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  }
  data.assignments.unshift(assignment)
  save(data)
  return assignment
}

export function getAssignments(classId?: string) {
  const list = load().assignments
  return classId ? list.filter((a) => a.classId === classId) : list
}

export function getAssignment(assignmentId: string) {
  return load().assignments.find((a) => a.id === assignmentId)
}

export function saveScanResult(input: {
  assignmentId: string
  detectedIds: number[]
  statuses: Record<string, SubmissionStatus>
  imageWidth?: number
  imageHeight?: number
  elapsedMs?: number
}) {
  const data = load()
  const students = data.students
  const now = new Date().toISOString()

  const session: ScanSession = {
    id: uid('scan'),
    assignmentId: input.assignmentId,
    detectedIds: [...input.detectedIds].sort((a, b) => a - b),
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
    elapsedMs: input.elapsedMs,
    createdAt: now,
  }
  data.scanSessions.unshift(session)

  data.submissions = data.submissions.filter(
    (s) => s.assignmentId !== input.assignmentId,
  )

  const assignment = data.assignments.find((a) => a.id === input.assignmentId)
  if (!assignment) {
    save(data)
    return session
  }

  const classStudents = students.filter((s) => s.classId === assignment.classId)
  for (const student of classStudents) {
    const status = input.statuses[student.id] ?? 'missing'
    data.submissions.push({
      id: uid('sub'),
      assignmentId: input.assignmentId,
      studentId: student.id,
      status,
      detectedAt: status === 'submitted' ? now : null,
      updatedAt: now,
    })
  }

  save(data)
  return session
}

export function getSubmissions(assignmentId: string) {
  return load().submissions.filter((s) => s.assignmentId === assignmentId)
}

export function getStudentMissingCounts(classId: string) {
  const data = load()
  const studentIds = new Set(
    data.students.filter((s) => s.classId === classId).map((s) => s.id),
  )
  const assignmentIds = new Set(
    data.assignments.filter((a) => a.classId === classId).map((a) => a.id),
  )
  const counts = new Map<string, number>()
  for (const sub of data.submissions) {
    if (!assignmentIds.has(sub.assignmentId) || !studentIds.has(sub.studentId)) {
      continue
    }
    if (sub.status === 'missing') {
      counts.set(sub.studentId, (counts.get(sub.studentId) ?? 0) + 1)
    }
  }
  return counts
}

export function parseStudentCsv(text: string): { studentNo: string; name: string }[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const rows: { studentNo: string; name: string }[] = []
  for (const line of lines) {
    // Skip header rows only (avoid matching student numbers like "no.3")
    if (/^(學號|姓名|student\s*(no|id|number)?|name)\b/i.test(line)) continue
    if (/^marker/i.test(line)) continue

    let parts = line.split(/[,，\t|;；]/).map((p) => p.trim()).filter(Boolean)
    if (parts.length < 2) {
      // Fallback: "1 陳大文" or "1　陳大文"
      parts = line.split(/[\s\u3000]+/).map((p) => p.trim()).filter(Boolean)
    }
    if (parts.length < 2) continue
    rows.push({ studentNo: parts[0], name: parts.slice(1).join(' ') })
  }
  return rows
}

export function exportSubmissionsCsv(assignmentId: string): string {
  const data = load()
  const assignment = data.assignments.find((a) => a.id === assignmentId)
  if (!assignment) return ''
  const students = data.students
    .filter((s) => s.classId === assignment.classId)
    .sort((a, b) => a.markerId - b.markerId)
  const subs = new Map(
    data.submissions
      .filter((s) => s.assignmentId === assignmentId)
      .map((s) => [s.studentId, s]),
  )
  const lines = ['學號,姓名,Marker ID,狀態']
  for (const s of students) {
    const status = subs.get(s.id)?.status ?? 'missing'
    lines.push(`${s.studentNo},${s.name},${s.markerId},${status}`)
  }
  return lines.join('\n')
}
