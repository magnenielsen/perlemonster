import { useState, useEffect } from 'react'
import { t } from '../i18n/no'
import { generatePattern, RateLimitError } from '../lib/ai'
import { quantizeImageData } from '../lib/quantize'
import type { ParsedPattern } from '../lib/grid'
import { Mascot } from '../components/Mascot'

const SIZE_MAP = {
  portrait: { rows: 21, cols: 13 },
  square:   { rows: 19, cols: 19 },
  large:    { rows: 29, cols: 29 },
}

const COLOR_COUNT: Record<'portrait' | 'square' | 'large', 8 | 15 | 30> = {
  portrait: 8, square: 8, large: 15,
}

async function imageBase64ToGrid(
  imageBase64: string,
  rows: number,
  cols: number,
  colorCount: 8 | 15 | 30,
): Promise<{ grid: ParsedPattern['grid']; palette: ParsedPattern['palette'] }> {
  const img = new Image()
  img.src = imageBase64
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('image load failed'))
  })

  // Draw full image so we can inspect pixels
  const full = document.createElement('canvas')
  full.width = img.width; full.height = img.height
  const fullCtx = full.getContext('2d')!
  fullCtx.drawImage(img, 0, 0)
  const { data, width, height } = fullCtx.getImageData(0, 0, img.width, img.height)

  // Sample a small block at each corner to determine background color
  const sampleCorner = (cx: number, cy: number) => {
    let r = 0, g = 0, b = 0
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) {
      const i = ((cy + dy) * width + (cx + dx)) * 4
      r += data[i]; g += data[i + 1]; b += data[i + 2]
    }
    return [r / 25, g / 25, b / 25]
  }
  const corners = [
    sampleCorner(0, 0), sampleCorner(width - 6, 0),
    sampleCorner(0, height - 6), sampleCorner(width - 6, height - 6),
  ]
  const bgR = corners.reduce((s, c) => s + c[0], 0) / 4
  const bgG = corners.reduce((s, c) => s + c[1], 0) / 4
  const bgB = corners.reduce((s, c) => s + c[2], 0) / 4

  // Find bounding box of pixels that differ significantly from the background
  let minX = width, maxX = 0, minY = height, maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const diff = Math.abs(data[i] - bgR) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bgB)
      if (diff > 90) {
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
      }
    }
  }

  // Fall back to full image if nothing detected
  if (minX >= maxX || minY >= maxY) { minX = 0; maxX = width - 1; minY = 0; maxY = height - 1 }

  // Add a small border so the background color shows as a thin frame
  const pad = Math.floor(Math.min(width, height) * 0.03)
  minX = Math.max(0, minX - pad); maxX = Math.min(width - 1, maxX + pad)
  minY = Math.max(0, minY - pad); maxY = Math.min(height - 1, maxY + pad)

  // Scale cropped subject to fill working canvas, filling with background color
  const out = document.createElement('canvas')
  out.width = 512; out.height = 512
  const outCtx = out.getContext('2d')!
  outCtx.fillStyle = `rgb(${Math.round(bgR)},${Math.round(bgG)},${Math.round(bgB)})`
  outCtx.fillRect(0, 0, 512, 512)
  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'
  outCtx.drawImage(full, minX, minY, maxX - minX + 1, maxY - minY + 1, 0, 0, 512, 512)

  const imageData = outCtx.getImageData(0, 0, 512, 512)
  const result = quantizeImageData(imageData, colorCount, 'skarp', rows, cols)
  return { grid: result.grid, palette: result.palette }
}

const POP_POSITIONS = [
  { left: '12%' }, { left: '30%' }, { left: '52%' }, { left: '68%' }, { left: '82%' },
]

function LoadingScreen() {
  const [xIdx, setXIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const tick = setInterval(() => setProgress(p => Math.min(p + 0.7, 92)), 100)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setXIdx(i => (i + 1) % POP_POSITIONS.length)
        setVisible(true)
      }, 350)
    }, 1800)
    return () => clearInterval(cycle)
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center gap-10"
      style={{ background: '#FFF8F0' }}>
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: POP_POSITIONS[xIdx].left,
        transition: 'left 0s, opacity 0.3s, transform 0.3s',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
      }}>
        <Mascot mood="drawing" size={130} />
      </div>
      <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.8rem', color: '#9B72CB', zIndex: 1 }}>
        {t.tagGenerating}
      </p>
      <div style={{ width: 260, height: 18, background: '#E8D5FF', borderRadius: 999, overflow: 'hidden', zIndex: 1 }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #9B72CB, #FF6B6B)',
          borderRadius: 999,
          transition: 'width 0.1s linear',
        }} />
      </div>
    </div>
  )
}

interface TagPickerProps {
  onDone: (result: ParsedPattern) => void
  onBack: () => void
}

const MAX_DAILY = 10

export function TagPicker({ onDone, onBack }: TagPickerProps) {
  const [moods, setMoods] = useState<string[]>([])
  const [theme, setTheme] = useState<string | null>(null)
  const [subject, setSubject] = useState<string | null>(null)
  const [size, setSize] = useState<'portrait' | 'square' | 'large'>('square')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [dailyUsed, setDailyUsed] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('pm_daily')
      if (!stored) return 0
      const { date, count } = JSON.parse(stored)
      if (date !== new Date().toDateString()) return 0
      return count
    } catch { return 0 }
  })

  const saveUsage = (n: number) => {
    localStorage.setItem('pm_daily', JSON.stringify({ date: new Date().toDateString(), count: n }))
    setDailyUsed(n)
  }

  const toggleMood = (id: string) => {
    setMoods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  const selectTheme = (id: string) => {
    const next = theme === id ? null : id
    setTheme(next)
    setSubject(null) // clear any subject when toggling theme
  }

  // The effective subject: theme ID takes precedence over subject picker
  const effectiveSubject = theme ?? subject

  const generate = async (isBust = false) => {
    if (!effectiveSubject) return
    const activeMoods = moods.length > 0 ? moods : ['søt']
    setLoading(true)
    setError(null)

    const attempt = async (retry: boolean): Promise<ParsedPattern> => {
      try {
        const { imageBase64 } = await generatePattern({ mood: activeMoods, subject: effectiveSubject, size, bust: isBust || retry })
        const { rows, cols } = SIZE_MAP[size]
        const colorCount = COLOR_COUNT[size]
        const { grid, palette } = await imageBase64ToGrid(imageBase64, rows, cols, colorCount)
        return { grid, palette, sourceImage: imageBase64 }
      } catch (e) {
        if (e instanceof RateLimitError) throw e
        if (!retry) return attempt(true)
        throw e
      }
    }

    try {
      const result = await attempt(false)
      saveUsage(dailyUsed + 1)
      setLoading(false)
      const moodLabels = activeMoods.map(id => t.moods.find(m => m.id === id)?.label ?? id).join(', ')
      const subjectLabel = t.themes.find(th => th.id === effectiveSubject)?.label
        ?? t.subjects.find(s => s.id === effectiveSubject)?.label
        ?? effectiveSubject
      onDone({ ...result, title: `${moodLabels} · ${subjectLabel}` })
    } catch (e) {
      setLoading(false)
      if (e instanceof RateLimitError) {
        setRateLimited(true)
        setError(t.tagRateLimit)
      } else {
        setError(t.tagError)
      }
    }
  }

  const canGenerate = (theme !== null || (moods.length > 0 && subject !== null)) && !rateLimited

  if (loading) return <LoadingScreen />

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 gap-8">
      <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '2rem', color: '#2D3047' }}>
        {t.tagPickerTitle}
      </h1>

      {/* Mood — hidden when a theme is selected */}
      {theme === null && (
        <div className="w-full max-w-xl">
          <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.2rem', color: '#2D3047', marginBottom: 12 }}>
            {t.tagMoodLabel}
          </p>
          <div className="flex flex-wrap gap-3">
            {t.moods.map(m => (
              <button
                key={m.id}
                onClick={() => toggleMood(m.id)}
                className={`tag-btn ${moods.includes(m.id) ? 'selected' : ''}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {moods.length === 0 && <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>{t.tagMoodRequired}</p>}
        </div>
      )}

      {/* Theme (optional) */}
      {t.themes.length > 0 && (
        <div className="w-full max-w-xl">
          <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.2rem', color: '#2D3047', marginBottom: 12 }}>
            {t.tagThemeLabel}
          </p>
          <div className="flex flex-wrap gap-3">
            {t.themes.map(th => (
              <button
                key={th.id}
                onClick={() => selectTheme(th.id)}
                className={`tag-btn ${theme === th.id ? 'selected' : ''}`}
              >
                {th.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Subject — hidden when a theme is selected */}
      {!theme && (
        <div className="w-full max-w-xl">
          <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.2rem', color: '#2D3047', marginBottom: 12 }}>
            {t.tagSubjectLabel}
          </p>
          <div className="flex flex-wrap gap-3">
            {t.subjects.map(s => (
              <button
                key={s.id}
                onClick={() => setSubject(s.id)}
                className={`tag-btn ${subject === s.id ? 'selected' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {!subject && <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: 6 }}>{t.tagSubjectRequired}</p>}
        </div>
      )}

      {/* Size */}
      <div className="w-full max-w-xl">
        <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.2rem', color: '#2D3047', marginBottom: 12 }}>
          {t.tagSizeLabel}
        </p>
        <div className="flex gap-3">
          {t.sizes.map(s => (
            <button
              key={s.id}
              onClick={() => setSize(s.id as 'portrait' | 'square' | 'large')}
              className={`tag-btn flex-1 flex flex-col items-center gap-1 ${size === s.id ? 'selected' : ''}`}
            >
              <span>{s.label}</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ maxWidth: 440, textAlign: 'center', borderLeft: '4px solid #FF6B6B' }}>
          <p style={{ fontFamily: "'Nunito', sans-serif", color: '#2D3047' }}>{error}</p>
        </div>
      )}

      <p style={{ color: '#aaa', fontSize: '0.85rem' }}>{t.tagCounter(dailyUsed, MAX_DAILY)}</p>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <button className="btn-secondary" onClick={onBack}>{t.tagBack}</button>
        <button
          className="btn-primary"
          disabled={!canGenerate}
          onClick={() => generate(false)}
        >
          {t.tagGenerate}
        </button>
      </div>
    </div>
  )
}
