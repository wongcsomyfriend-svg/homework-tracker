import { useMemo, useRef, useState } from 'react'
import { unlockAudio, playDing } from '../lib/audio'
import {
  detectFromImageData,
  fileToImageData,
} from '../lib/detectClient'
import { generateMarkerSvg, MAX_MARKER_ID } from '../lib/dict4x4_50'
import type { DetectedMarker } from '../lib/types'

const SIZES_CM = [1, 1.2, 1.5] as const

export function SpikePage() {
  const [status, setStatus] = useState('尚未掃描')
  const [result, setResult] = useState<{
    width: number
    height: number
    elapsedMs: number
    markers: DetectedMarker[]
    megapixels: string
  } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const sheet = useMemo(() => {
    return SIZES_CM.map((cm) => ({
      cm,
      ids: Array.from({ length: 50 }, (_, i) => i),
    }))
  }, [])

  async function onPick(file: File | null) {
    if (!file) return
    unlockAudio()
    setBusy(true)
    setStatus('分析中…')
    try {
      const url = URL.createObjectURL(file)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      const imageData = await fileToImageData(file)
      const detection = await detectFromImageData(imageData, {
        mode: 'tiled',
        tileCols: 4,
        tileRows: 4,
        overlap: 0.25,
      })
      const megapixels = ((imageData.width * imageData.height) / 1e6).toFixed(1)
      setResult({
        width: detection.width,
        height: detection.height,
        elapsedMs: detection.elapsedMs,
        markers: detection.markers.sort((a, b) => a.id - b.id),
        megapixels,
      })
      drawOverlay(imageData, detection.markers)
      setStatus(
        `認出 ${detection.markers.length} / ${MAX_MARKER_ID + 1}（${detection.elapsedMs} ms）`,
      )
      if (detection.markers.length >= MAX_MARKER_ID + 1) {
        playDing()
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '偵測失敗')
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
    ctx.lineWidth = Math.max(2, imageData.width / 800)
    ctx.font = `${Math.max(14, imageData.width / 80)}px sans-serif`
    for (const m of markers) {
      ctx.strokeStyle = '#16a34a'
      ctx.fillStyle = 'rgba(22, 163, 74, 0.85)'
      ctx.beginPath()
      m.corners.forEach((c, i) => {
        if (i === 0) ctx.moveTo(c.x, c.y)
        else ctx.lineTo(c.x, c.y)
      })
      ctx.closePath()
      ctx.stroke()
      const label = String(m.id)
      ctx.fillText(label, m.corners[0].x, m.corners[0].y - 4)
    }
  }

  return (
    <div className="space-y-5">
      <section className="panel p-5">
        <h1 className="text-2xl font-bold">Phase 0 · 可行性驗證</h1>
        <p className="mt-2 text-[var(--muted)]">
          列印下方三種尺寸（1 / 1.2 / 1.5 cm）的 DICT_4X4_50 標籤，貼真簿後用 5 疊 × 10
          本擺法影一張最高解析度相，確認辨識率與你手機的實際像素。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              unlockAudio()
              fileRef.current?.click()
            }}
          >
            {busy ? '分析中…' : '影相 / 上傳測試'}
          </button>
          <button
            type="button"
            className="btn btn-secondary no-print"
            onClick={() => window.print()}
          >
            列印標籤頁
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
          />
        </div>
        <p className="mt-3 text-sm font-semibold text-[var(--accent)]">{status}</p>
        {result && (
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--accent-soft)] p-3">
              解析度：{result.width} × {result.height}（{result.megapixels} MP）
            </div>
            <div className="rounded-xl bg-[var(--accent-soft)] p-3">
              平均 marker 邊長：
              {result.markers.length
                ? `${Math.round(
                    result.markers.reduce((s, m) => s + m.sizePx, 0) /
                      result.markers.length,
                  )} px`
                : '—'}
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3 sm:col-span-2">
              已認 ID：
              {result.markers.length
                ? result.markers.map((m) => m.id).join(', ')
                : '無'}
            </div>
            <div className="rounded-xl border border-[var(--line)] p-3 sm:col-span-2">
              未認 ID：
              {Array.from({ length: 50 }, (_, i) => i)
                .filter((id) => !result.markers.some((m) => m.id === id))
                .join(', ') || '無（全中）'}
            </div>
          </div>
        )}
      </section>

      {(previewUrl || result) && (
        <section className="panel overflow-hidden p-3">
          <canvas ref={canvasRef} className="max-h-[70vh] w-full object-contain" />
        </section>
      )}

      <section className="print-sheet space-y-8">
        {sheet.map((group) => (
          <div key={group.cm} className="panel p-4 break-inside-avoid">
            <h2 className="mb-3 text-lg font-bold">
              {group.cm} cm 標籤（DICT_4X4_50 · ID 0–49）
            </h2>
            <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
              {group.ids.map((id) => (
                <div key={`${group.cm}-${id}`} className="text-center">
                  <div
                    className="mx-auto"
                    style={{ width: `${group.cm}cm`, height: `${group.cm}cm` }}
                    dangerouslySetInnerHTML={{ __html: generateMarkerSvg(id) }}
                  />
                  <div className="mt-1 text-[10px] font-semibold">
                    {group.cm}cm · #{id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
