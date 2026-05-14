import { useState, useCallback } from 'react'
import { t } from '../i18n/no'
import { BeadGrid } from '../components/BeadGrid'
import { PALETTE } from '../lib/palette'
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

export function Edit({ grid: initialGrid, palette: initialPalette, onDone, onBack, onNewIdea }: EditProps) {
  const [history, setHistory] = useState<Grid[]>([initialGrid])
  const [future, setFuture] = useState<Grid[]>([])
  const [palette, setPalette] = useState<PerlerColor[]>(initialPalette)
  const [selectedColor, setSelectedColor] = useState(0)

  const current = history[history.length - 1]

  // Determine which palette indices are used in the current grid
  const usedIndices = new Set<number>()
  for (const row of current) for (const v of row) usedIndices.add(v)

  const selectedCode = palette[selectedColor]?.code

  // Pick any color from the full PALETTE; adds to local palette if not already there
  const pickGlobalColor = useCallback((globalColor: PerlerColor) => {
    setPalette(prev => {
      const existing = prev.findIndex(c => c.code === globalColor.code)
      if (existing !== -1) {
        setSelectedColor(existing)
        return prev
      }
      setSelectedColor(prev.length)
      return [...prev, globalColor]
    })
  }, [])

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

      {/* Colour picker */}
      <div className="card w-full" style={{ maxWidth: 520 }}>
        {/* Pattern colors */}
        <p style={{ fontFamily: "'Fredoka', sans-serif", color: '#888', fontSize: '0.85rem', marginBottom: 6 }}>
          {t.editColorPicker}
        </p>
        <div className="flex flex-wrap gap-2" style={{ marginBottom: 14 }}>
          {palette.map((color, idx) => (
            <button
              key={color.code}
              title={color.name}
              onClick={() => setSelectedColor(idx)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: color.hex,
                border: selectedCode === color.code ? '3px solid #2D3047' : '2px solid #e5e7eb',
                cursor: 'pointer',
                boxShadow: selectedCode === color.code ? '0 0 0 2px white inset' : undefined,
                opacity: usedIndices.has(idx) ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Full Perler palette */}
        <p style={{ fontFamily: "'Fredoka', sans-serif", color: '#888', fontSize: '0.85rem', marginBottom: 6 }}>
          {t.editAllColors}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE.map(color => (
            <button
              key={color.code}
              title={color.name}
              onClick={() => pickGlobalColor(color)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: color.hex,
                border: selectedCode === color.code ? '3px solid #2D3047' : '1.5px solid #e5e7eb',
                cursor: 'pointer',
                boxShadow: selectedCode === color.code ? '0 0 0 2px white inset' : undefined,
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
