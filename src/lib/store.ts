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
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyData()
    return { ...emptyData(), ...JSON.parse(raw) } as AppData
  } catch {
    return emptyData()
  }
}

function save(data: AppData) {
  localStorage.setItem(KEY, JSON.stringify(data))
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
  const data = load()
  data.students = data.students.filter((s) => s.classId !== classId)
  const created: Student[] = rows.slice(0, 50).map((row, index) => ({
    id: uid('stu'),
    classId,
    studentNo: row.studentNo.trim(),
    name: row.name.trim(),
    markerId: index,
  }))
  data.students.push(...created)
  save(data)
  return created
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
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const rows: { studentNo: string; name: string }[] = []
  for (const line of lines) {
    if (/^(學號|student|no)/i.test(line)) continue
    const parts = line.split(/[,，\t]/).map((p) => p.trim())
    if (parts.length < 2) continue
    rows.push({ studentNo: parts[0], name: parts[1] })
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
