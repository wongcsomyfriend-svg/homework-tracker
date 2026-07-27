import type {
  Assignment,
  ClassRoom,
  ScanSession,
  Student,
  SubmissionStatus,
} from './types'
import { getAdapter, getStorageDriver, getStorageModeLabel } from './storage/driver'

export { getStorageDriver, getStorageModeLabel }

export function getData() {
  return getAdapter().getData()
}

export function subscribe(cb: () => void) {
  return getAdapter().subscribe(cb)
}

export async function readyStorage() {
  return getAdapter().ready()
}

export function getWorkspaceState() {
  return getAdapter().getWorkspaceState()
}

export async function createSchool(name: string) {
  return getAdapter().createSchool(name)
}

export async function joinSchool(code: string) {
  return getAdapter().joinSchool(code)
}

export async function getJoinCode() {
  return getAdapter().getJoinCode()
}

export async function rotateJoinCode() {
  return getAdapter().rotateJoinCode()
}

export async function getStudentClaimCode(studentId: string) {
  return getAdapter().getStudentClaimCode(studentId)
}

export async function rotateStudentClaimCode(studentId: string) {
  return getAdapter().rotateStudentClaimCode(studentId)
}

export async function listStudentLinks(studentId: string) {
  return getAdapter().listStudentLinks(studentId)
}

export async function unlinkStudent(studentId: string, userId?: string) {
  return getAdapter().unlinkStudent(studentId, userId)
}

export async function updateSchoolName(name: string) {
  return getAdapter().updateSchoolName(name)
}

export async function createClass(name: string, schoolYear: string) {
  return getAdapter().createClass(name, schoolYear)
}

export async function deleteClass(classId: string) {
  return getAdapter().deleteClass(classId)
}

export function getClass(classId: string) {
  return getAdapter().getClass(classId)
}

export function getStudents(classId: string) {
  return getAdapter().getStudents(classId)
}

export function findStudentNoConflict(
  classId: string,
  studentNo: string,
  excludeStudentId?: string,
) {
  return getAdapter().findStudentNoConflict(
    classId,
    studentNo,
    excludeStudentId,
  )
}

export async function importStudents(
  classId: string,
  rows: { studentNo: string; name: string }[],
) {
  return getAdapter().importStudents(classId, rows)
}

export async function addStudent(
  classId: string,
  studentNo: string,
  name: string,
): Promise<Student> {
  return getAdapter().addStudent(classId, studentNo, name)
}

export async function updateStudent(
  studentId: string,
  patch: { studentNo?: string; name?: string },
) {
  return getAdapter().updateStudent(studentId, patch)
}

export async function removeStudent(studentId: string) {
  return getAdapter().removeStudent(studentId)
}

export async function reassignMarkerIds(classId: string) {
  return getAdapter().reassignMarkerIds(classId)
}

export async function createAssignment(
  classId: string,
  title: string,
  subject: string,
  dueDate: string,
): Promise<Assignment> {
  return getAdapter().createAssignment(classId, title, subject, dueDate)
}

export async function deleteAssignment(assignmentId: string) {
  return getAdapter().deleteAssignment(assignmentId)
}

export function getAssignments(classId?: string) {
  return getAdapter().getAssignments(classId)
}

export function getAssignment(assignmentId: string) {
  return getAdapter().getAssignment(assignmentId)
}

export async function saveScanResult(input: {
  assignmentId: string
  detectedIds: number[]
  statuses: Record<string, SubmissionStatus>
  imageWidth?: number
  imageHeight?: number
  elapsedMs?: number
}): Promise<ScanSession> {
  return getAdapter().saveScanResult(input)
}

export function getSubmissions(assignmentId: string) {
  return getAdapter().getSubmissions(assignmentId)
}

export function getStudentMissingCounts(classId: string) {
  return getAdapter().getStudentMissingCounts(classId)
}

export async function exportWorkspaceJson() {
  return getAdapter().exportJson()
}

export async function importWorkspaceJson(json: string) {
  return getAdapter().importJson(json)
}

export function parseStudentCsv(text: string): { studentNo: string; name: string }[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const rows: { studentNo: string; name: string }[] = []
  for (const line of lines) {
    if (/^(學號|姓名|student\s*(no|id|number)?|name)\b/i.test(line)) continue
    if (/^marker/i.test(line)) continue

    let parts = line.split(/[,，\t|;；]/).map((p) => p.trim()).filter(Boolean)
    if (parts.length < 2) {
      parts = line.split(/[\s\u3000]+/).map((p) => p.trim()).filter(Boolean)
    }
    if (parts.length < 2) continue
    rows.push({ studentNo: parts[0], name: parts.slice(1).join(' ') })
  }
  return rows
}

export function exportSubmissionsCsv(assignmentId: string): string {
  const data = getData()
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

export type { ClassRoom }
