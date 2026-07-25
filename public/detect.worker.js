/* global AR, CV */
// Relative paths resolve against this worker's own URL, so the same build
// works at a domain root and under a GitHub Pages subpath.
importScripts('vendor/cv.js', 'vendor/aruco.js', 'vendor/aruco_4x4_1000.js')

const MAX_ID = 49
const detector = new AR.Detector({
  dictionaryName: 'ARUCO_4X4_1000',
  maxHammingDistance: 2,
})

function detectFull(width, height, data) {
  return detector.detectImage(width, height, data)
}

function detectTiled(width, height, data, tileCols, tileRows, overlap) {
  const byId = new Map()
  const tileW = Math.ceil(width / tileCols)
  const tileH = Math.ceil(height / tileRows)
  const ox = Math.floor(tileW * overlap)
  const oy = Math.floor(tileH * overlap)

  for (let row = 0; row < tileRows; row++) {
    for (let col = 0; col < tileCols; col++) {
      let x0 = col * tileW - ox
      let y0 = row * tileH - oy
      let x1 = (col + 1) * tileW + ox
      let y1 = (row + 1) * tileH + oy
      x0 = Math.max(0, x0)
      y0 = Math.max(0, y0)
      x1 = Math.min(width, x1)
      y1 = Math.min(height, y1)
      const tw = x1 - x0
      const th = y1 - y0
      if (tw < 32 || th < 32) continue

      const tile = new Uint8ClampedArray(tw * th * 4)
      for (let y = 0; y < th; y++) {
        const src = ((y0 + y) * width + x0) * 4
        const dst = y * tw * 4
        tile.set(data.subarray(src, src + tw * 4), dst)
      }

      const markers = detectFull(tw, th, tile)
      for (const m of markers) {
        if (m.id > MAX_ID) continue
        const corners = m.corners.map((c) => ({
          x: c.x + x0,
          y: c.y + y0,
        }))
        const side =
          Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y) +
          Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y)
        const sizePx = side / 2
        const prev = byId.get(m.id)
        if (!prev || sizePx > prev.sizePx) {
          byId.set(m.id, {
            id: m.id,
            corners,
            sizePx,
            hammingDistance: m.hammingDistance,
          })
        }
      }
    }
  }

  return Array.from(byId.values())
}

self.onmessage = (event) => {
  const {
    requestId,
    width,
    height,
    buffer,
    mode = 'tiled',
    tileCols = 3,
    tileRows = 3,
    overlap = 0.2,
  } = event.data

  try {
    const data = new Uint8ClampedArray(buffer)
    const started = performance.now()
    let markers
    if (mode === 'full') {
      markers = detectFull(width, height, data)
        .filter((m) => m.id <= MAX_ID)
        .map((m) => {
          const corners = m.corners
          const side =
            Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y) +
            Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y)
          return {
            id: m.id,
            corners,
            sizePx: side / 2,
            hammingDistance: m.hammingDistance,
          }
        })
    } else {
      markers = detectTiled(width, height, data, tileCols, tileRows, overlap)
    }

    // Also run full-image pass and merge — helps large nearby markers
    if (mode === 'tiled') {
      const full = detectFull(width, height, data)
      for (const m of full) {
        if (m.id > MAX_ID) continue
        const corners = m.corners
        const side =
          Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y) +
          Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y)
        const sizePx = side / 2
        const existing = markers.find((x) => x.id === m.id)
        if (!existing) {
          markers.push({
            id: m.id,
            corners,
            sizePx,
            hammingDistance: m.hammingDistance,
          })
        } else if (sizePx > existing.sizePx) {
          existing.corners = corners
          existing.sizePx = sizePx
          existing.hammingDistance = m.hammingDistance
        }
      }
    }

    const elapsedMs = Math.round(performance.now() - started)
    self.postMessage({
      requestId,
      ok: true,
      markers,
      elapsedMs,
      width,
      height,
    })
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
