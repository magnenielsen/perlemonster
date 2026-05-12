import { useState, useCallback } from 'react'
import { t } from '../i18n/no'
import { BeadGrid } from '../components/BeadGrid'
import type { PerlerColor } from '../lib/palette'
import type { Grid } from '../lib/quantize'

interface EditProps {
  grid: Grid
  palette: PerlerColor[]
  onDone: (grid: Grid, palette: PerlerColor[]) => void
  onBack: () => void
  /** If set, show "Gi meg en ny" button for AI path */
  onNewIdea?: () => void
}

export function Edit({ grid: initialGrid, palette, onDone, onBack, onNewIdea }: EditProps) {
  const [history, setHistory] = useState<Grid[]>([initialGrid])
  const [future, setFuture] = useState<Grid[]>([])
  const [selectedColor, setSelectedColor] = useState(0)

  const current = history[history.length - 1]

  // Determine which palette indices are used in the current grid
  const usedIndices = new Set<number>()
  for (const row of current) for (const v of row) usedIndices.add(v)
  const usedColors: { idx: number; color: PerlerColor }[] = []
  palette.forEach((c, i) => { if (usedIndices.has(i)) usedColors.push({ idx: i, color: c }) })

  const paintCell = useCallback((row: number, col: number) => {
    const prev = history[history.length - 1]
    if (prev[row][col] === selectedColor) return
    const next = prev.map((r, ri) =>
      ri === row ? r.map((v, ci) => ci === col ? selectedColor : v) : r
    )
    setHistory(h => [...h, next])
    setFuture([])
  }, [history, selectedColor])

  const undo = () => {
    if (history.length <= 1) return
    setFuture(f => [history[history.length - 1], ...f])
    setHistory(h => h.slice(0, -1))
  }

  const redo = () => {
    if (future.length === 0) return
    setHistory(h => [...h, future[0]])
    setFuture(f => f.slice(1))
  }

  const reset = () => {
    setHistory([initialGrid])
    setFuture([])
  }

  // Responsive cell size
  const cellSize = typeof window !== 'undefined' && window.innerWidth < 500 ? 11 : 15

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 gap-6">
      <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.8rem', color: '#2D3047' }}>
        {t.editTitle}
      </h1>

      {/* Grid */}
      <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
        <BeadGrid
          grid={current}
          palette={palette}
          editMode
          selectedColor={selectedColor}
          onCellPaint={paintCell}
          cellSize={cellSize}
        />
      </div>

      {/* Colour picker — only colours present in pattern */}
      <div className="card w-full" style={{ maxWidth: 520 }}>
        <p style={{ fontFamily: "'Fredoka', sans-serif", color: '#888', fontSize: '0.9rem', marginBottom: 8 }}>
          {t.editColorPicker}
        </p>
        <div className="flex flex-wrap gap-2">
          {usedColors.map(({ idx, color }) => (
            <button
              key={idx}
              title={color.name}
              onClick={() => setSelectedColor(idx)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: color.hex,
                border: selectedColor === idx ? '3px solid #2D3047' : '2px solid #e5e7eb',
                cursor: 'pointer',
                boxShadow: selectedColor === idx ? '0 0 0 2px white inset' : undefined,
              }}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button className="btn-secondary" onClick={undo} disabled={history.length <= 1}>{t.editUndo}</button>
        <button className="btn-secondary" onClick={redo} disabled={future.length === 0}>{t.editRedo}</button>
        <button className="btn-secondary" onClick={reset}>{t.editReset}</button>
        {onNewIdea && (
          <button className="btn-sunshine" onClick={onNewIdea}>{t.tagNew}</button>
        )}
      </div>

      <div className="flex gap-4">
        <button className="btn-secondary" onClick={onBack}>{t.editBack}</button>
        <button className="btn-primary" onClick={() => onDone(current, palette)}>{t.editNext}</button>
      </div>
    </div>
  )
}
