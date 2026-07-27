export type SubmissionStatus = 'submitted' | 'missing' | 'late' | 'excused'

export interface School {
  id: string
  name: string
}

export interface ClassRoom {
  id: string
  schoolId: string
  name: string
  schoolYear: string
  createdAt: string
}

export interface Student {
  id: string
  classId: string
  studentNo: string
  name: string
  markerId: number
  claimCode?: string | null
}

export type WorkspaceState = 'ready' | 'needsOnboarding' | 'signedOut'

export interface Assignment {
  id: string
  classId: string
  title: string
  subject: string
  dueDate: string
  createdAt: string
}

export interface Submission {
  id: string
  assignmentId: string
  studentId: string
  status: SubmissionStatus
  detectedAt: string | null
  updatedAt: string
}

export interface ScanSession {
  id: string
  assignmentId: string
  detectedIds: number[]
  imageWidth?: number
  imageHeight?: number
  elapsedMs?: number
  createdAt: string
}

export interface DetectedMarker {
  id: number
  corners: { x: number; y: number }[]
  sizePx: number
  hammingDistance?: number
}

export interface DetectionResult {
  markers: DetectedMarker[]
  elapsedMs: number
  width: number
  height: number
}

export interface AppData {
  school: School
  classes: ClassRoom[]
  students: Student[]
  assignments: Assignment[]
  submissions: Submission[]
  scanSessions: ScanSession[]
}
