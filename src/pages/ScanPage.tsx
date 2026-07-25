import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { playDing, unlockAudio } from '../lib/audio'
import {
  detectFromImageData,
  fileToImageData,
  videoFrameToImageData,
} from '../lib/detectClient'
import { useData } from '../hooks/useData'
import type { DetectedMarker, SubmissionStatus } from '../lib/types'

type Mode = 'photo' | 'live'

export function ScanPage() {
  const { assignmentId = '' } = useParams()
  const navigate = useNavigate()
  const data = useData()
  const assignment = data.assignments.find((a) => a.id === assignmentId)
  const students = useMemo(
    () =>
      data.students
        .filter((s) => s.classId === assignment?.classId)
        .sort((a, b) => a.markerId - b.markerId),
    [data, assignment?.classId],
  )

  const [mode, setMode] = useState<Mode>('photo')
  const [detected, setDetected] = useState<Map<number, DetectedMarker>>(new Map())
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('準備掃描')
  const [flash, setFlash] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [liveOn, setLiveOn] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const hitsRef = useRef<Map<number, number>>(new Map())
  const doneRef = useRef(false)

  const expectedIds = useMemo(
    () => new Set(students.map((s) => s.markerId)),
    [students],
  )
  const foundCount = [...detected.keys()].filter((id) => expectedIds.has(id)).length
  const missingStudents = students.filter((s) => !detected.has(s.markerId))

  useEffect(() => {
    return () => stopLive()
  }, [])

  useEffect(() => {
    if (
      doneRef.current ||
      students.length === 0 ||
      foundCount < students.length
    ) {
      return
    }
    doneRef.current = true
    setFlash(true)
    playDing()
    setStatus('已掃齊全班！')
    const timer = window.setTimeout(() => {
      stopLive()
      const statuses: Record<string, SubmissionStatus> = {}
      for (const s of students) {
        statuses[s.id] = detected.has(s.markerId) ? 'submitted' : 'missing'
      }
      sessionStorage.setItem(
        `scan:${assignmentId}`,
        JSON.stringify({
          detectedIds: [...detected.keys()],
          statuses,
          markers: [...detected.values()],
        }),
      )
      navigate(`/result/${assignmentId}`)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [foundCount, students, detected, assignmentId, navigate])

  function mergeMarkers(markers: DetectedMarker[]) {
    setDetected((prev) => {
      const next = new Map(prev)
      for (const m of markers) {
        if (!expectedIds.has(m.id) && expectedIds.size > 0) continue
        const old = next.get(m.id)
        if (!old || m.sizePx > old.sizePx) next.set(m.id, m)
      }
      return next
    })
  }

  async function onPhoto(file: File | null) {
    if (!file) return
    unlockAudio()
    setBusy(true)
    setStatus('分析相片中…')
    try {
      const url = URL.createObjectURL(file)
      setPreview((p) => {
        if (p) URL.revokeObjectURL(p)
        return url
      })
      const imageData = await fileToImageData(file)
      const result = await detectFromImageData(imageData, {
        mode: 'tiled',
        tileCols: imageData.width > 3000 ? 4 : 3,
        tileRows: imageData.height > 3000 ? 4 : 3,
        overlap: 0.25,
      })
      mergeMarkers(result.markers)
      drawOverlay(imageData, result.markers)
      setStatus(
        `本張認出 ${result.markers.length} 個（${result.width}×${result.height}，${result.elapsedMs} ms）`,
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '偵測失敗')
    } finally {
      setBusy(false)
    }
  }

  async function takePhotoAndroid() {
    unlockAudio()
    setBusy(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
        audio: false,
      })
      const track = stream.getVideoTracks()[0]
      const ImageCaptureCtor = (
        window as unknown as {
          ImageCapture?: new (track: MediaStreamTrack) => {
            takePhoto: () => Promise<Blob>
          }
        }
      ).ImageCapture
      if (!ImageCaptureCtor) {
        stream.getTracks().forEach((t) => t.stop())
        fileRef.current?.click()
        return
      }
      const capture = new ImageCaptureCtor(track)
      const blob = await capture.takePhoto()
      stream.getTracks().forEach((t) => t.stop())
      await onPhoto(new File([blob], 'capture.jpg', { type: blob.type }))
    } catch {
      fileRef.current?.click()
    } finally {
      setBusy(false)
    }
  }

  function drawOverlay(imageData: ImageData, markers: DetectedMarker[]) {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.putImageData(imageData, 0, 0)
    ctx.lineWidth = Math.max(2, imageData.width / 900)
    ctx.font = `bold ${Math.max(16, imageData.width / 70)}px sans-serif`
    for (const m of markers) {
      ctx.strokeStyle = '#16a34a'
      ctx.fillStyle = '#166534'
      ctx.beginPath()
      m.corners.forEach((c, i) => {
        if (i === 0) ctx.moveTo(c.x, c.y)
        else ctx.lineTo(c.x, c.y)
      })
      ctx.closePath()
      ctx.stroke()
      const student = students.find((s) => s.markerId === m.id)
      ctx.fillText(
        student ? `${student.studentNo}` : `#${m.id}`,
        m.corners[0].x,
        Math.max(20, m.corners[0].y - 6),
      )
    }
  }

  async function startLive() {
    unlockAudio()
    stopLive()
    setMode('live')
    setLiveOn(true)
    setStatus('即時掃描中…慢慢掃過每一疊')
    hitsRef.current = new Map()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      let last = 0
      const loop = async (ts: number) => {
        rafRef.current = requestAnimationFrame(loop)
        if (ts - last < 180) return
        last = ts
        if (!video.videoWidth) return
        try {
          const imageData = await videoFrameToImageData(video)
          const result = await detectFromImageData(imageData, { mode: 'full' })
          const confirmed: DetectedMarker[] = []
          for (const m of result.markers) {
            if (expectedIds.size && !expectedIds.has(m.id)) continue
            const hits = (hitsRef.current.get(m.id) ?? 0) + 1
            hitsRef.current.set(m.id, hits)
            if (hits >= 2) confirmed.push(m)
          }
          if (confirmed.length) mergeMarkers(confirmed)
        } catch {
          /* skip frame */
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      setLiveOn(false)
      setStatus(err instanceof Error ? err.message : '無法開啟鏡頭')
    }
  }

  function stopLive() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLiveOn(false)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  function goResult() {
    stopLive()
    const statuses: Record<string, SubmissionStatus> = {}
    for (const s of students) {
      statuses[s.id] = detected.has(s.markerId) ? 'submitted' : 'missing'
    }
    sessionStorage.setItem(
      `scan:${assignmentId}`,
      JSON.stringify({
        detectedIds: [...detected.keys()],
        statuses,
        markers: [...detected.values()],
      }),
    )
    navigate(`/result/${assignmentId}`)
  }

  if (!assignment) {
    return <div className="panel p-5">找不到功課項目。</div>
  }

  return (
    <div className={`space-y-4 ${flash ? 'animate-pulse' : ''}`}>
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--muted)]">掃描功課</p>
            <h1 className="text-2xl font-bold">{assignment.title}</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              已認出 {foundCount} / {students.length}
            </p>
          </div>
          <Link to={`/classes/${assignment.classId}`} className="btn btn-ghost">
            取消
          </Link>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full bg-[var(--accent)] transition-all"
            style={{
              width: `${students.length ? (foundCount / students.length) * 100 : 0}%`,
            }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-[var(--accent)]">{status}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn ${mode === 'photo' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setMode('photo')
              stopLive()
            }}
          >
            一次過掃描
          </button>
          <button
            type="button"
            className={`btn ${mode === 'live' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => void startLive()}
          >
            即時掃描
          </button>
        </div>

        {mode === 'photo' && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !students.length}
              onClick={() => {
                unlockAudio()
                // Prefer file/capture for iOS; try ImageCapture on Android
                const ua = navigator.userAgent
                if (/Android/i.test(ua)) void takePhotoAndroid()
                else fileRef.current?.click()
              }}
            >
              {busy ? '分析中…' : preview ? '再影一張補掃' : '影相掃描'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
        )}

        {mode === 'live' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!liveOn ? (
              <button type="button" className="btn btn-primary" onClick={() => void startLive()}>
                開鏡頭
              </button>
            ) : (
              <button type="button" className="btn btn-danger" onClick={stopLive}>
                停止鏡頭
              </button>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!students.length}
            onClick={() => {
              unlockAudio()
              goResult()
            }}
          >
            完成並查看結果
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              doneRef.current = false
              setDetected(new Map())
              hitsRef.current = new Map()
              setStatus('已重設累積結果')
            }}
          >
            重設
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        {mode === 'live' ? (
          <video
            ref={videoRef}
            className="max-h-[55vh] w-full bg-black object-contain"
            playsInline
            muted
          />
        ) : (
          <canvas ref={canvasRef} className="max-h-[55vh] w-full object-contain" />
        )}
      </section>

      <section className="panel p-4">
        <h2 className="font-bold">尚未認出（{missingStudents.length}）</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {missingStudents.length === 0 ? (
            <span className="badge badge-ok">全班已認出</span>
          ) : (
            missingStudents.map((s) => (
              <span key={s.id} className="badge badge-missing">
                {s.studentNo} {s.name}
              </span>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
