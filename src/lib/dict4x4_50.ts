/** OpenCV DICT_4X4_50 — first 50 codes from ARUCO_4X4_1000 (2 bytes each). */
export const DICT_4X4_50: [number, number][] = [
  [181, 50],
  [15, 154],
  [51, 45],
  [153, 70],
  [84, 158],
  [121, 205],
  [158, 46],
  [196, 242],
  [254, 218],
  [207, 86],
  [249, 145],
  [17, 167],
  [14, 183],
  [42, 15],
  [36, 177],
  [38, 62],
  [70, 101],
  [102, 0],
  [108, 94],
  [118, 175],
  [134, 139],
  [176, 43],
  [204, 213],
  [221, 130],
  [254, 71],
  [148, 113],
  [172, 228],
  [165, 84],
  [33, 35],
  [52, 111],
  [68, 21],
  [87, 178],
  [158, 207],
  [240, 203],
  [8, 174],
  [9, 41],
  [24, 117],
  [4, 255],
  [13, 246],
  [28, 90],
  [23, 24],
  [42, 40],
  [50, 140],
  [56, 178],
  [36, 232],
  [46, 235],
  [45, 63],
  [75, 100],
  [80, 46],
  [80, 19],
]

export const MARKER_CELL = 6 // 4 data + 2 border
export const MAX_MARKER_ID = 49

export function codeToBits(code: [number, number]): string {
  return (
    code[0].toString(2).padStart(8, '0') + code[1].toString(2).padStart(8, '0')
  )
}

/** Vector SVG for OpenCV DICT_4X4 marker (white quiet zone included). */
export function generateMarkerSvg(id: number): string {
  if (id < 0 || id >= DICT_4X4_50.length) {
    throw new Error(`Marker id must be 0–${DICT_4X4_50.length - 1}`)
  }
  const bits = codeToBits(DICT_4X4_50[id])
  const size = 4
  const vb = size + 4 // quiet zone 1 cell each side around black border
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}" shape-rendering="crispEdges">`
  svg += `<rect x="0" y="0" width="${vb}" height="${vb}" fill="white"/>`
  svg += `<rect x="1" y="1" width="${size + 2}" height="${size + 2}" fill="black"/>`
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (bits[y * size + x] === '1') {
        svg += `<rect x="${x + 2}" y="${y + 2}" width="1" height="1" fill="white"/>`
      }
    }
  }
  svg += '</svg>'
  return svg
}
