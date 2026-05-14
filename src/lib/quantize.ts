import { rgbToLab, nearestPerlerIndex, PALETTE } from './palette'
import type { PerlerColor } from './palette'

export type Grid = number[][] // n×n, each value is index into active palette

export interface QuantizeResult {
  grid: Grid
  palette: PerlerColor[] // subset of PALETTE actually used
}

function randomInt(n: number): number {
  return Math.floor(Math.random() * n)
}

// k-means clustering in LAB space
function kmeans(pixels: [number, number, number][], k: number, iterations = 20): number[] {
  const n = pixels.length
  // Init centroids with k-means++ style (random picks)
  const centroids: [number, number, number][] = []
  centroids.push(pixels[randomInt(n)])
  while (centroids.length < k) {
    centroids.push(pixels[randomInt(n)])
  }

  let assignments = new Int32Array(n)

  for (let iter = 0; iter < iterations; iter++) {
    // Assignment step
    for (let i = 0; i < n; i++) {
      let best = 0, bestDist = Infinity
      for (let c = 0; c < k; c++) {
        const dx = pixels[i][0] - centroids[c][0]
        const dy = pixels[i][1] - centroids[c][1]
        const dz = pixels[i][2] - centroids[c][2]
        const d = dx*dx + dy*dy + dz*dz
        if (d < bestDist) { bestDist = d; best = c }
      }
      assignments[i] = best
    }

    // Update step
    const sums: [number, number, number][] = Array.from({ length: k }, () => [0, 0, 0])
    const counts = new Int32Array(k)
    for (let i = 0; i < n; i++) {
      const c = assignments[i]
      sums[c][0] += pixels[i][0]
      sums[c][1] += pixels[i][1]
      sums[c][2] += pixels[i][2]
      counts[c]++
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c] = [sums[c][0]/counts[c], sums[c][1]/counts[c], sums[c][2]/counts[c]]
      }
    }
  }

  // Map each centroid to nearest Perler palette index
  const centroidPerlerIdx = centroids.map(lab => nearestPerlerIndex(lab))

  // Build final assignments as Perler palette indices
  return Array.from(assignments).map(c => centroidPerlerIdx[c])
}

export function quantizeImageData(
  imageData: ImageData,
  colorCount: 8 | 15 | 30,
  _style: 'glatt' | 'skarp',
  gridRows: number = 29,
  gridCols: number = gridRows
): QuantizeResult {
  const { data, width, height } = imageData
  const pixels: [number, number, number][] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      pixels.push(rgbToLab(data[idx], data[idx+1], data[idx+2]))
    }
  }

  const perlerIndices = kmeans(pixels, colorCount)

  const usedIndices = new Set<number>(perlerIndices)
  const globalToLocal = new Map<number, number>()
  const activePalette: PerlerColor[] = []
  usedIndices.forEach(gi => {
    globalToLocal.set(gi, activePalette.length)
    activePalette.push(PALETTE[gi])
  })

  // Area averaging: each output cell takes the majority-vote Perler colour
  // from the source pixels in its region — much more accurate than center-pixel sampling
  const grid: Grid = []
  for (let row = 0; row < gridRows; row++) {
    const rowArr: number[] = []
    for (let col = 0; col < gridCols; col++) {
      const x0 = Math.floor(col * width / gridCols)
      const x1 = Math.max(x0 + 1, Math.floor((col + 1) * width / gridCols))
      const y0 = Math.floor(row * height / gridRows)
      const y1 = Math.max(y0 + 1, Math.floor((row + 1) * height / gridRows))

      const votes = new Map<number, number>()
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const gi = perlerIndices[py * width + px]
          votes.set(gi, (votes.get(gi) ?? 0) + 1)
        }
      }

      let bestGi = perlerIndices[y0 * width + x0]
      let bestVotes = 0
      votes.forEach((count, gi) => { if (count > bestVotes) { bestVotes = count; bestGi = gi } })
      rowArr.push(globalToLocal.get(bestGi) ?? 0)
    }
    grid.push(rowArr)
  }

  return { grid, palette: activePalette }
}
