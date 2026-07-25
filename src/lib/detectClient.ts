import type { DetectionResult, DetectedMarker } from './types'

type WorkerResponse =
  | {
      requestId: number
      ok: true
      markers: DetectedMarker[]
      elapsedMs: number
      width: number
      height: number
    }
  | {
      requestId: number
      ok: false
      error: string
    }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<
  number,
  { resolve: (v: DetectionResult) => void; reject: (e: Error) => void }
>()

function getWorker() {
  if (!worker) {
    worker = new Worker(`${import.meta.env.BASE_URL}detect.worker.js`)
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      const slot = pending.get(msg.requestId)
      if (!slot) return
      pending.delete(msg.requestId)
      if (!msg.ok) {
        slot.reject(new Error(msg.error))
        return
      }
      slot.resolve({
        markers: msg.markers,
        elapsedMs: msg.elapsedMs,
        width: msg.width,
        height: msg.height,
      })
    }
    worker.onerror = (err) => {
      for (const [, slot] of pending) {
        slot.reject(new Error(err.message || 'Worker error'))
      }
      pending.clear()
    }
  }
  return worker
}

export async function detectFromImageData(
  imageData: ImageData,
  options?: {
    mode?: 'tiled' | 'full'
    tileCols?: number
    tileRows?: number
    overlap?: number
  },
): Promise<DetectionResult> {
  const w = getWorker()
  const requestId = nextId++
  const buffer = imageData.data.buffer.slice(0)

  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
    w.postMessage(
      {
        requestId,
        width: imageData.width,
        height: imageData.height,
        buffer,
        mode: options?.mode ?? 'tiled',
        tileCols: options?.tileCols ?? 3,
        tileRows: options?.tileRows ?? 3,
        overlap: options?.overlap ?? 0.25,
      },
      [buffer],
    )
  })
}

export async function imageElementToImageData(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
): Promise<ImageData> {
  const width =
    'naturalWidth' in source
      ? source.naturalWidth || source.width
      : source.width
  const height =
    'naturalHeight' in source
      ? source.naturalHeight || source.height
      : source.height

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D not available')
  ctx.drawImage(source as CanvasImageSource, 0, 0)
  return ctx.getImageData(0, 0, width, height)
}

export async function fileToImageData(file: Blob): Promise<ImageData> {
  const bitmap = await createImageBitmap(file)
  try {
    return await imageElementToImageData(bitmap)
  } finally {
    bitmap.close()
  }
}

export async function videoFrameToImageData(
  video: HTMLVideoElement,
): Promise<ImageData> {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas 2D not available')
  ctx.drawImage(video, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
