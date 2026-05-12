import perlerColors from '../../public/palette/perler-colors.json'

export interface PerlerColor {
  code: string
  name: string
  hex: string
}

export const PALETTE: PerlerColor[] = perlerColors

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// sRGB -> linear
function linearize(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

// linear RGB -> CIE XYZ (D65)
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const lr = linearize(r), lg = linearize(g), lb = linearize(b)
  return [
    lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375,
    lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750,
    lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041,
  ]
}

function f(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
}

// XYZ -> CIE Lab (D65 reference white)
export function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const fx = f(x / 0.95047), fy = f(y / 1.0), fz = f(z / 1.08883)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  return xyzToLab(...rgbToXyz(r, g, b))
}

export function hexToLab(hex: string): [number, number, number] {
  return rgbToLab(...hexToRgb(hex))
}

function deltaE(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2)
}

// Pre-compute Lab values for the full palette
const PALETTE_LAB: [number, number, number][] = PALETTE.map(c => hexToLab(c.hex))

export function nearestPerlerIndex(lab: [number, number, number]): number {
  let best = 0, bestDist = Infinity
  for (let i = 0; i < PALETTE_LAB.length; i++) {
    const d = deltaE(lab, PALETTE_LAB[i])
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

export function nearestPerler(lab: [number, number, number]): PerlerColor {
  return PALETTE[nearestPerlerIndex(lab)]
}
