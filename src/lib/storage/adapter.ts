import type {
  AppData,
  Assignment,
  ClassRoom,
  ScanSession,
  Student,
  Submission,
  SubmissionStatus,
} from '../types'

export type StorageDriver = 'local' | 'supabase'

export interface StorageAdapter {
  readonly driver: StorageDriver

  /** Load / refresh cache. Safe to call multiple times. */
  ready(): Promise<void>

  getData(): AppData
  subscribe(cb: () => void): () => void

  updateSchoolName(name: string): Promise<void>
  createClass(name: string, schoolYear: string): Promise<ClassRoom>
  deleteClass(classId: string): Promise<void>
  getClass(classId: string): ClassRoom | undefined
  getStudents(classId: string): Student[]

  findStudentNoConflict(
    classId: string,
    studentNo: string,
    excludeStudentId?: string,
  ): Student | null

  importStudents(
    classId: string,
    rows: { studentNo: string; name: string }[],
  ): Promise<Student[]>

  addStudent(
    classId: string,
    studentNo: string,
    name: string,
  ): Promise<Student>

  updateStudent(
    studentId: string,
    patch: { studentNo?: string; name?: string },
  ): Promise<Student>

  removeStudent(studentId: string): Promise<void>
  reassignMarkerIds(classId: string): Promise<void>

  createAssignment(
    classId: string,
    title: string,
    subject: string,
    dueDate: string,
  ): Promise<Assignment>

  deleteAssignment(assignmentId: string): Promise<void>
  getAssignments(classId?: string): Assignment[]
  getAssignment(assignmentId: string): Assignment | undefined

  saveScanResult(input: {
    assignmentId: string
    detectedIds: number[]
    statuses: Record<string, SubmissionStatus>
    imageWidth?: number
    imageHeight?: number
    elapsedMs?: number
  }): Promise<ScanSession>

  getSubmissions(assignmentId: string): Submission[]
  getStudentMissingCounts(classId: string): Map<string, number>

  /** Full workspace snapshot for backup / migration. */
  exportJson(): Promise<string>
  importJson(json: string): Promise<void>
}
