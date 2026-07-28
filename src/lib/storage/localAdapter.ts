import { uid } from '../id'
import type {
  AppData,
  Assignment,
  ClassRoom,
  ScanSession,
  Student,
  Submission,
  WorkspaceState,
} from '../types'
import type { StorageAdapter } from './adapter'
import { notifyDataChanged, subscribeData } from './notify'

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
  notifyDataChanged()
}

function normalizeStudentNo(studentNo: string) {
  return studentNo.trim()
}

function missingCounts(data: AppData, classId: string): Map<string, number> {
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

function cloudOnly(): never {
  throw new Error('此功能需要雲端模式')
}

export function createLocalAdapter(): StorageAdapter {
  return {
    driver: 'local',

    async ready() {
      if (!localStorage.getItem(KEY)) {
        save(emptyData())
      }
    },

    getData: load,

    getWorkspaceState(): WorkspaceState {
      return 'ready'
    },

    subscribe: subscribeData,

    async createSchool() {
      cloudOnly()
    },

    async joinSchool() {
      cloudOnly()
    },

    async getJoinCode() {
      return null
    },

    async rotateJoinCode() {
      cloudOnly()
    },

    async getStudentClaimCode() {
      return null
    },

    async rotateStudentClaimCode() {
      cloudOnly()
    },

    async listStudentLinks() {
      return []
    },

    async unlinkStudent() {
      cloudOnly()
    },

    async updateSchoolName(name: string) {
      const data = load()
      data.school.name = name.trim() || data.school.name
      save(data)
    },

    async createClass(name: string, schoolYear: string) {
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
    },

    async deleteClass(classId: string) {
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
    },

    getClass(classId: string) {
      return load().classes.find((c) => c.id === classId)
    },

    getStudents(classId: string) {
      return load()
        .students.filter((s) => s.classId === classId)
        .sort((a, b) => a.markerId - b.markerId)
    },

    findStudentNoConflict(classId, studentNo, excludeStudentId) {
      const normalized = normalizeStudentNo(studentNo)
      if (!normalized) return null
      return (
        load().students.find(
          (s) =>
            s.classId === classId &&
            s.id !== excludeStudentId &&
            normalizeStudentNo(s.studentNo) === normalized,
        ) ?? null
      )
    },

    async importStudents(classId, rows) {
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
    },

    async addStudent(classId, studentNo, name) {
      const data = load()
      const existing = data.students.filter((s) => s.classId === classId)
      if (existing.length >= 50) throw new Error('每班最多 50 人')
      const no = normalizeStudentNo(studentNo)
      if (!no) throw new Error('請填寫學號')
      if (existing.some((s) => normalizeStudentNo(s.studentNo) === no)) {
        throw new Error(`學號「${no}」已存在，請使用其他學號`)
      }
      const used = new Set(existing.map((s) => s.markerId))
      let markerId = 0
      while (used.has(markerId) && markerId < 50) markerId += 1
      const student: Student = {
        id: uid('stu'),
        classId,
        studentNo: no,
        name: name.trim(),
        markerId,
      }
      data.students.push(student)
      save(data)
      return student
    },

    async updateStudent(studentId, patch) {
      const data = load()
      const student = data.students.find((s) => s.id === studentId)
      if (!student) throw new Error('找不到學生')
      if (patch.studentNo !== undefined) {
        const no = normalizeStudentNo(patch.studentNo)
        if (!no) throw new Error('學號不能留空')
        const conflict = data.students.find(
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
        student.studentNo = no
      }
      if (patch.name !== undefined) student.name = patch.name.trim()
      save(data)
      return student
    },

    async removeStudent(studentId) {
      const data = load()
      data.students = data.students.filter((s) => s.id !== studentId)
      data.submissions = data.submissions.filter((s) => s.studentId !== studentId)
      save(data)
    },

    async reassignMarkerIds(classId) {
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
        s.markerId = 1000 + index
      })
      list.forEach((s, index) => {
        s.markerId = index
      })
      save(data)
    },

    async createAssignment(classId, title, subject, dueDate) {
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
    },

    async deleteAssignment(assignmentId) {
      const data = load()
      const existed = data.assignments.some((a) => a.id === assignmentId)
      if (!existed) throw new Error('找不到該功課紀錄')
      data.assignments = data.assignments.filter((a) => a.id !== assignmentId)
      data.submissions = data.submissions.filter(
        (s) => s.assignmentId !== assignmentId,
      )
      data.scanSessions = data.scanSessions.filter(
        (s) => s.assignmentId !== assignmentId,
      )
      save(data)
    },

    getAssignments(classId) {
      const list = load().assignments
      return classId ? list.filter((a) => a.classId === classId) : list
    },

    getAssignment(assignmentId) {
      return load().assignments.find((a) => a.id === assignmentId)
    },

    async saveScanResult(input) {
      const data = load()
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

      const assignment = data.assignments.find(
        (a) => a.id === input.assignmentId,
      )
      if (!assignment) {
        save(data)
        return session
      }

      const classStudents = data.students.filter(
        (s) => s.classId === assignment.classId,
      )
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
    },

    getSubmissions(assignmentId): Submission[] {
      return load().submissions.filter((s) => s.assignmentId === assignmentId)
    },

    getStudentMissingCounts(classId) {
      return missingCounts(load(), classId)
    },

    async exportJson() {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        driver: 'local' as const,
        data: load(),
      }
      return JSON.stringify(payload, null, 2)
    },

    async importJson(json: string) {
      const parsed = JSON.parse(json) as {
        version?: number
        data?: Partial<AppData>
      }
      const incoming = parsed.data ?? (parsed as Partial<AppData>)
      if (!incoming || typeof incoming !== 'object') {
        throw new Error('匯入檔案格式不正確')
      }
      const base = emptyData()
      const next: AppData = {
        school: incoming.school ?? base.school,
        classes: Array.isArray(incoming.classes) ? incoming.classes : [],
        students: Array.isArray(incoming.students) ? incoming.students : [],
        assignments: Array.isArray(incoming.assignments)
          ? incoming.assignments
          : [],
        submissions: Array.isArray(incoming.submissions)
          ? incoming.submissions
          : [],
        scanSessions: Array.isArray(incoming.scanSessions)
          ? incoming.scanSessions
          : [],
      }
      save(next)
    },
  }
}
