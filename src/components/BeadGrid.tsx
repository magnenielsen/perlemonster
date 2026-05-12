import { useRef, useCallback } from 'react'
import type { PerlerColor } from '../lib/palette'
import type { Grid } from '../lib/quantize'

interface BeadGridProps {
  grid: Grid
  palette: PerlerColor[]
  editMode?: boolean
  selectedColor?: number // palette index
  onCellPaint?: (row: number, col: number) => void
  cellSize?: number
}

function contrastText(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? '#00000055' : '#ffffff55'
}

export function BeadGrid({ grid, palette, editMode, selectedColor, onCellPaint, cellSize = 16 }: BeadGridProps) {
  const isPainting = useRef(false)

  const handleMouseDown = useCallback((row: number, col: number) => {
    if (!editMode) return
    isPainting.current = true
    onCellPaint?.(row, col)
  }, [editMode, onCellPaint])

  const handleMouseEnter = useCallback((row: number, col: number) => {
    if (!editMode || !isPainting.current) return
    onCellPaint?.(row, col)
  }, [editMode, onCellPaint])

  const handleMouseUp = useCallback(() => { isPainting.current = false }, [])

  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  return (
    <div
      className="relative select-none overflow-auto"
      onMouseLeave={handleMouseUp}
      onMouseUp={handleMouseUp}
      style={{ touchAction: editMode ? 'none' : 'auto' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          width: cols * cellSize,
          height: rows * cellSize,
          border: '2px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
          cursor: editMode ? 'crosshair' : 'default',
        }}
      >
        {grid.map((row, rowIdx) =>
          row.map((colorIdx, colIdx) => {
            const color = palette[colorIdx]
            const isSelected = editMode && selectedColor === colorIdx
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                title={color?.name}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: color?.hex ?? '#ccc',
                  boxShadow: isSelected ? `inset 0 0 0 2px white, inset 0 0 0 3px ${color?.hex}` : undefined,
                  position: 'relative',
                }}
                onMouseDown={() => handleMouseDown(rowIdx, colIdx)}
                onMouseEnter={() => handleMouseEnter(rowIdx, colIdx)}
                onTouchStart={() => { isPainting.current = true; onCellPaint?.(rowIdx, colIdx) }}
              >
                {cellSize >= 14 && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: cellSize * 0.45,
                      color: contrastText(color?.hex ?? '#ccc'),
                      fontFamily: 'monospace',
                      userSelect: 'none',
                      pointerEvents: 'none',
                    }}
                  >
                    {String.fromCharCode(65 + colorIdx)}
                  </span>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
