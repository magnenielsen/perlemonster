import LZString from 'lz-string'
import type { PerlerColor } from './palette'
import type { Grid } from './quantize'

interface SharePayload {
  grid: Grid
  palette: PerlerColor[]
  title?: string
}

export function encodePattern(payload: SharePayload): string {
  const json = JSON.stringify({
    g: payload.grid,
    p: payload.palette.map(c => ({ n: c.name, c: c.code, h: c.hex })),
    t: payload.title,
  })
  return LZString.compressToEncodedURIComponent(json)
}

export function decodePattern(hash: string): SharePayload | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(hash)
    if (!json) return null
    const raw = JSON.parse(json)
    return {
      grid: raw.g,
      palette: raw.p.map((p: { n: string; c: string; h: string }) => ({
        name: p.n, code: p.c, hex: p.h,
      })),
      title: raw.t,
    }
  } catch {
    return null
  }
}

export function buildShareUrl(payload: SharePayload): string {
  const encoded = encodePattern(payload)
  return `${window.location.origin}${window.location.pathname}#${encoded}`
}
