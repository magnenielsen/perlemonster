import type { ParsedPattern } from './grid'
import type { PerlerColor } from './palette'
import type { Grid } from './quantize'

export interface GenerateRequest {
  mood: string[]
  subject: string
  size?: 'small' | 'medium' | 'large'
  bust?: boolean // true = skip cache (Gi meg en ny)
}

export async function generatePattern(req: GenerateRequest): Promise<ParsedPattern> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}))
    throw new RateLimitError(data.remaining ?? 0)
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const data = await res.json()

  const palette: PerlerColor[] = (data.palette as Array<{ code: string; name: string; hex: string }>).map(p => ({
    code: p.code,
    name: p.name,
    hex: p.hex,
  }))
  const rows = (data.grid as string).split('\n').filter((r: string) => r.length > 0)
  const size = rows.length
  const grid: Grid = rows.map(row => {
    const chars = [...row].slice(0, size)
    while (chars.length < size) chars.push('A')
    return chars.map(ch => {
      const idx = ch.charCodeAt(0) - 65
      return Math.max(0, Math.min(idx, palette.length - 1))
    })
  })
  return { grid, palette, title: data.title as string | undefined }
}

export class RateLimitError extends Error {
  remaining: number
  constructor(remaining: number) {
    super('rate_limit')
    this.remaining = remaining
  }
}
