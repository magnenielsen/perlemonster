type MascotMood = 'idle' | 'drawing' | 'sleeping'

// Colours
const b = '#9B72CB'  // lavender body
const d = '#6A3FA0'  // dark purple (horns, outline)
const e = '#FFFFFF'  // eye white
const p = '#2D3047'  // pupil
const c = '#FF6B6B'  // coral cheeks
const h = '#D4B8FF'  // highlight

const _ = ''

// 29 × 29 grid. Monster peeks up — eyes + head fill the centre,
// body bleeds to the bottom edge for the "peeking over" silhouette.
const ART: string[][] = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,d,d,_,_,_,_,_,_,_,_,_,_,_,d,d,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,d,d,_,_,_,_,_,_,_,_,_,_,_,d,d,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,d,d,d,_,_,_,_,_,_,_,_,_,_,d,d,d,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,b,b,b,b,b,b,b,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,b,b,b,b,b,b,b,b,b,b,b,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,b,b,b,h,h,b,b,b,b,h,h,b,b,b,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,_,_,_,_,_,_],
  [_,_,_,_,_,_,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,_,_,_,_,_],
  [_,_,_,_,_,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,_,_,_,_],
  [_,_,_,_,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,_,_,_],
  [_,_,_,b,b,b,b,e,e,e,e,b,b,b,b,b,b,e,e,e,e,b,b,b,b,b,_,_,_],
  [_,_,_,b,b,b,e,e,e,e,e,e,b,b,b,b,e,e,e,e,e,e,b,b,b,b,_,_,_],
  [_,_,_,b,b,b,e,e,p,p,e,e,b,b,b,b,e,e,p,p,e,e,b,b,b,b,_,_,_],
  [_,_,_,b,b,b,e,e,p,p,e,e,b,b,b,b,e,e,p,p,e,e,b,b,b,b,_,_,_],
  [_,_,_,b,b,b,e,e,e,e,e,e,b,b,b,b,e,e,e,e,e,e,b,b,b,b,_,_,_],
  [_,_,_,b,b,b,b,e,e,e,e,b,b,b,b,b,b,e,e,e,e,b,b,b,b,b,_,_,_],
  [_,_,_,_,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,_,_,_],
  [_,_,_,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,_,_],
  [_,_,b,b,b,b,c,c,b,b,b,b,b,b,b,b,b,b,b,b,c,c,b,b,b,b,b,b,_],
  [_,_,b,b,b,b,c,c,b,b,b,b,b,b,b,b,b,b,b,b,c,c,b,b,b,b,b,b,_],
  [_,_,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,_],
  [_,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b],
  [b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b],
  [b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b],
  [b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b],
  [b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b],
  [b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b,b],
]

const CELL = 10
const SIZE = 29

interface MascotProps {
  mood?: MascotMood
  size?: number
  className?: string
}

export function Mascot({ mood = 'idle', size = 120, className = '' }: MascotProps) {
  const svgW = SIZE * CELL
  // Show rows 0–24 (the face + start of body at peek line) — clips body bleed
  const svgH = 25 * CELL

  return (
    <svg
      width={size}
      height={Math.round(size * (svgH / svgW))}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className={className}
      aria-label="Perlemonsteret"
    >
      {ART.map((row, y) =>
        row.map((color, x) => {
          if (!color) return null
          // Apply mood tint: sleeping dims everything slightly
          const fill = mood === 'sleeping' ? color + 'BB' : color
          return (
            <rect
              key={`${y}-${x}`}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill={fill}
            />
          )
        })
      )}

      {/* Sleeping: zzz */}
      {mood === 'sleeping' && (
        <>
          <text x={svgW * 0.68} y={svgH * 0.22} fontSize={28} fill={d} fontFamily="monospace" fontWeight="bold">z</text>
          <text x={svgW * 0.76} y={svgH * 0.12} fontSize={22} fill={d} fontFamily="monospace" fontWeight="bold">z</text>
          <text x={svgW * 0.83} y={svgH * 0.05} fontSize={16} fill={d} fontFamily="monospace" fontWeight="bold">z</text>
        </>
      )}

      {/* Drawing: pencil doodle in corner */}
      {mood === 'drawing' && (
        <g transform={`translate(${svgW * 0.72}, ${svgH * 0.6})`}>
          <rect x={0} y={0} width={36} height={10} rx={3} fill="#FF6B6B" />
          <polygon points="36,0 46,5 36,10" fill="#FFD93D" />
        </g>
      )}
    </svg>
  )
}
