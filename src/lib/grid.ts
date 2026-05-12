import type { PerlerColor } from './palette'
import type { Grid } from './quantize'

export interface ParsedPattern {
  grid: Grid
  palette: PerlerColor[]
  title?: string
}

// Parse Claude's compact grid response:
// grid is "29 newline-delimited rows, each 29 chars A-Z"
// palette is [{idx, name, code, hex}, ...]
export function parseClaudeResponse(raw: string): ParsedPattern {
  const json = JSON.parse(raw) as {
    title?: string
    palette: { idx: number; name: string; code: string; hex: string }[]
    grid: string
  }

  const palette: PerlerColor[] = json.palette.map(p => ({
    code: p.code,
    name: p.name,
    hex: p.hex,
  }))

  const rows = json.grid.split('\n').filter(r => r.length > 0)
  const size = rows.length

  const grid: Grid = rows.map(row => {
    const chars = [...row].slice(0, size)
    return chars.map(ch => {
      const idx = ch.charCodeAt(0) - 65 // A=0, B=1, ...
      if (idx < 0 || idx >= palette.length) throw new Error(`Bad index char '${ch}'`)
      return idx
    })
  })

  return { grid, palette, title: json.title }
}
