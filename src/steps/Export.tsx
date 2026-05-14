import { useState } from 'react'
import { t } from '../i18n/no'
import { BeadGrid } from '../components/BeadGrid'
import { generatePDF } from '../lib/pdf'
import { buildShareUrl } from '../lib/share'
import { useWakeLock } from '../lib/useWakeLock'
import type { PerlerColor } from '../lib/palette'
import type { Grid } from '../lib/quantize'

interface ExportProps {
  grid: Grid
  palette: PerlerColor[]
  onBack: () => void
  onNew: () => void
  initialTitle?: string
}

export function Export({ grid, palette, onBack, onNew, initialTitle = '' }: ExportProps) {
  const [title, setTitle] = useState(initialTitle)
  const [copied, setCopied] = useState(false)
  const { supported: wakeLockSupported, active: wakeLockActive, toggle: toggleWakeLock } = useWakeLock()

  const handlePDF = () => {
    generatePDF(grid, palette, title || 'Perlemonster')
  }

  const handleShare = async () => {
    const url = buildShareUrl({ grid, palette, title })
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback: select a hidden input
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  // Legend
  const counts = new Map<number, number>()
  for (const row of grid) for (const v of row) counts.set(v, (counts.get(v) ?? 0) + 1)

  const usedPalette: { idx: number; color: PerlerColor; count: number }[] = []
  palette.forEach((c, i) => {
    const n = counts.get(i) ?? 0
    if (n > 0) usedPalette.push({ idx: i, color: c, count: n })
  })

  const cellSize = typeof window !== 'undefined' && window.innerWidth < 500 ? 10 : 14

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8 gap-6">
      <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.8rem', color: '#2D3047' }}>
        {t.exportTitle}
      </h1>

      {/* Grid preview */}
      <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
        <BeadGrid grid={grid} palette={palette} cellSize={cellSize} />
      </div>

      {/* Title input */}
      <div className="w-full" style={{ maxWidth: 440 }}>
        <label
          htmlFor="pattern-title"
          style={{ fontFamily: "'Nunito', sans-serif", color: '#888', fontSize: '0.9rem', display: 'block', marginBottom: 6 }}
        >
          {t.exportNameLabel}
        </label>
        <input
          id="pattern-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t.exportNamePlaceholder}
          maxLength={50}
          style={{
            width: '100%',
            padding: '0.65rem 1rem',
            borderRadius: '0.75rem',
            border: '2px solid #e5e7eb',
            fontFamily: "'Nunito', sans-serif",
            fontSize: '1rem',
            outline: 'none',
            color: '#2D3047',
          }}
          onFocus={e => (e.target.style.borderColor = '#FF6B6B')}
          onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
        />
      </div>

      {/* Colour legend */}
      <div className="card w-full" style={{ maxWidth: 440 }}>
        <div className="flex flex-wrap gap-3">
          {usedPalette.map(({ idx, color, count }) => (
            <div key={idx} className="flex items-center gap-2" style={{ minWidth: 140 }}>
              <div
                style={{ width: 20, height: 20, borderRadius: 4, background: color.hex, border: '1px solid #e5e7eb', flexShrink: 0 }}
              />
              <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: '0.85rem', color: '#2D3047' }}>
                {String.fromCharCode(65 + idx)} {color.name} ({count})
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button className="btn-primary" onClick={handlePDF}>{t.exportPdf}</button>
        <button className="btn-sky" onClick={handleShare}>
          {copied ? t.exportShareDone : t.exportShare}
        </button>
        {wakeLockSupported && (
          <button
            onClick={toggleWakeLock}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '0.75rem',
              border: wakeLockActive ? '2px solid #F59E0B' : '2px solid #e5e7eb',
              background: wakeLockActive ? '#FEF3C7' : '#fff',
              color: wakeLockActive ? '#92400E' : '#888',
              fontFamily: "'Fredoka', sans-serif",
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {wakeLockActive ? t.exportWakeActive : t.exportWake}
          </button>
        )}
      </div>

      <div className="flex gap-4">
        <button className="btn-secondary" onClick={onBack}>{t.exportBack}</button>
        <button className="btn-secondary" onClick={onNew}>{t.exportNew}</button>
      </div>

      <footer style={{ color: '#aaa', fontSize: '0.8rem', textAlign: 'center', marginTop: 8 }}>
        {t.footer}
      </footer>
    </div>
  )
}
