// Each cell renders as a rounded square — like a single Perler bead.

interface PixelIconProps {
  grid: string[][]
  cellSize?: number
  className?: string
}

export function PixelIcon({ grid, cellSize = 5, className = '' }: PixelIconProps) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const w = cols * cellSize
  const h = rows * cellSize
  const bead = cellSize - 1
  const r = bead / 2

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden="true"
    >
      {grid.map((row, y) =>
        row.map((color, x) => {
          if (!color) return null
          return (
            <rect
              key={`${y}-${x}`}
              x={x * cellSize + 0.5}
              y={y * cellSize + 0.5}
              width={bead}
              height={bead}
              rx={r}
              fill={color}
            />
          )
        })
      )}
    </svg>
  )
}

// ─── Colours ─────────────────────────────────────────────────────
const _ = ''
const F = '#2D3047'  // frame charcoal
const S = '#4D96FF'  // sky blue
const M = '#9B72CB'  // mountain lavender
const W = '#FFFFFF'  // white / snow
const G = '#6BCB77'  // grass green
const C = '#FF6B6B'  // coral (sun glow)

// Polaroid photo with landscape — 14 × 14, light frame
export const PHOTO_PIXELS: string[][] = [
  [_,F,F,F,F,F,F,F,F,F,F,F,F,_],
  [F,W,W,W,W,W,W,W,W,W,W,W,W,F],
  [F,W,S,S,S,S,S,S,S,S,S,S,W,F],
  [F,W,S,S,S,S,C,C,S,S,S,S,W,F],
  [F,W,S,S,S,S,C,C,S,S,S,S,W,F],
  [F,W,S,S,M,S,S,S,S,S,M,S,W,F],
  [F,W,S,M,W,M,S,S,S,M,W,M,W,F],
  [F,W,M,M,M,M,M,M,M,M,M,M,W,F],
  [F,W,G,G,G,G,G,G,G,G,G,G,W,F],
  [F,W,W,W,W,W,W,W,W,W,W,W,W,F],
  [F,W,W,W,W,W,W,W,W,W,W,W,W,F],
  [F,W,W,W,W,W,W,W,W,W,W,W,W,F],
  [F,W,W,W,W,W,W,W,W,W,W,W,W,F],
  [_,F,F,F,F,F,F,F,F,F,F,F,F,_],
]

// Lightbulb — 14 × 14
const B  = '#FFD93D'  // bulb yellow
const BL = '#FFF3A3'  // inner glow pale yellow
const GR = '#AAAAAA'  // base/socket gray
const DK = '#666666'  // dark socket stripe

export const BULB_PIXELS: string[][] = [
  [_,_,_,_,_,B,B,B,B,_,_,_,_,_],
  [_,_,_,_,B,B,BL,BL,B,B,_,_,_,_],
  [_,_,_,B,B,BL,BL,BL,BL,B,B,_,_,_],
  [_,_,B,B,BL,BL,BL,BL,BL,BL,B,B,_,_],
  [_,_,B,BL,BL,BL,BL,BL,BL,BL,BL,B,_,_],
  [_,_,B,BL,BL,BL,BL,BL,BL,BL,BL,B,_,_],
  [_,_,B,BL,BL,BL,BL,BL,BL,BL,BL,B,_,_],
  [_,_,B,B,BL,BL,BL,BL,BL,BL,B,B,_,_],
  [_,_,_,B,B,B,B,B,B,B,B,_,_,_],
  [_,_,_,_,GR,GR,GR,GR,GR,GR,_,_,_,_],
  [_,_,_,_,DK,DK,DK,DK,DK,DK,_,_,_,_],
  [_,_,_,_,GR,GR,GR,GR,GR,GR,_,_,_,_],
  [_,_,_,_,_,GR,GR,GR,GR,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_],
]
