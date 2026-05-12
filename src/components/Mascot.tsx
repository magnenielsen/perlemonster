// The Perlemonster mascot — a friendly pixel monster drawn on a 29×29 grid SVG.
// Three moods: idle, drawing (loading), sleeping (error).

type MascotMood = 'idle' | 'drawing' | 'sleeping'

const SIZE = 29
const CELL = 10

// Colour palette for the mascot (inline, not from Perler palette)
const C = {
  bg:    'transparent',
  body:  '#9B72CB',  // lavender body
  dark:  '#6A3FA0',  // outline / shadows
  eye:   '#FFFFFF',
  pupil: '#2D3047',
  mouth: '#2D3047',
  acc:   '#FF6B6B',  // coral accents
  shine: '#D4B8FF',  // highlight on body
}

// 29x29 pixel art monster — rough hand-crafted layout
// 0=bg, 1=body, 2=dark, 3=eye, 4=pupil, 5=mouth, 6=acc, 7=shine
const IDLE_ART = `
00000000000002222200000000000
00000000000021111120000000000
00000000000211111112000000000
00000000002111711112200000000
00000000021117711111200000000
00000000211177711111120000000
00000002111777711111112000000
00000021177777711111112000000
00000211777777711111112000000
00002117777777711111112000000
00021177777777711111112000000
00211777777777711111112000000
02117777777777711111112000000
21177777777777711111112000000
21177777777777711111112000000
02222222222222222222220000000
00222112222222222112220000000
00221332222222223332220000000
00022133222222233132200000000
00002213342222433122000000000
00000222222222222220000000000
00000022222222222000000000000
00000002222222220000000000000
00000000222222000000000000000
00000000022220000000000000000
00000000002200000000000000000
00000000000000000000000000000
00000000000000000000000000000
00000000000000000000000000000
`.trim().split('\n')

// Map digit to colour
const COLOR_MAP: Record<string, string> = {
  '0': C.bg, '1': C.body, '2': C.dark, '3': C.eye, '4': C.pupil,
  '5': C.mouth, '6': C.acc, '7': C.shine,
}

interface MascotProps {
  mood?: MascotMood
  size?: number
  className?: string
}

export function Mascot({ mood = 'idle', size = 120, className = '' }: MascotProps) {
  const art = IDLE_ART
  const svgSize = SIZE * CELL

  // Sleeping overlay: Z's animation
  const showZzz = mood === 'sleeping'
  // Drawing overlay: pencil wiggle (CSS animation via style)
  const drawingStyle = mood === 'drawing' ? { animation: 'spin-slow 3s linear infinite' } : {}

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      className={`${className} ${mood === 'drawing' ? 'animate-pulse' : ''}`}
      aria-label="Perlemonsteret"
    >
      {art.map((row, y) =>
        [...row].map((ch, x) => {
          const fill = COLOR_MAP[ch] ?? 'transparent'
          if (fill === 'transparent') return null
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

      {showZzz && (
        <>
          <text x={svgSize * 0.6} y={svgSize * 0.2} fontSize={24} fill={C.dark} fontFamily="monospace" fontWeight="bold">z</text>
          <text x={svgSize * 0.7} y={svgSize * 0.1} fontSize={18} fill={C.dark} fontFamily="monospace" fontWeight="bold">z</text>
          <text x={svgSize * 0.78} y={svgSize * 0.04} fontSize={14} fill={C.dark} fontFamily="monospace" fontWeight="bold">z</text>
        </>
      )}

      {mood === 'drawing' && (
        <g style={drawingStyle} transform={`translate(${svgSize * 0.7}, ${svgSize * 0.7})`}>
          <rect x={0} y={0} width={30} height={8} rx={2} fill={C.acc} />
          <polygon points="30,0 38,4 30,8" fill={C.shine} />
        </g>
      )}
    </svg>
  )
}
