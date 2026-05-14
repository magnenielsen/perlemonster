import { useState, useEffect } from 'react'
import { t } from '../i18n/no'
import { generatePattern, RateLimitError } from '../lib/ai'
import { quantizeImageData } from '../lib/quantize'
import type { ParsedPattern } from '../lib/grid'
import { Mascot } from '../components/Mascot'

const SIZE_MAP = {
  small:    { rows: 11, cols: 11 },
  portrait: { rows: 21, cols: 13 },
  square:   { rows: 19, cols: 19 },
  large:    { rows: 29, cols: 29 },
}

const COLOR_COUNT: Record<'small' | 'portrait' | 'square' | 'large', 8 | 15 | 30> = {
  small: 8, portrait: 8, square: 8, large: 15,
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

  // Scale full image to working canvas — background color is part of the design
  const out = document.createElement('canvas')
  out.width = 512; out.height = 512
  const outCtx = out.getContext('2d')!
  outCtx.imageSmoothingEnabled = true
  outCtx.imageSmoothingQuality = 'high'
  outCtx.drawImage(img, 0, 0, 512, 512)

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
  const [subject, setSubject] = useState<string | null>(null)
  const [size, setSize] = useState<'small' | 'portrait' | 'square' | 'large'>('small')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [dailyUsed, setDailyUsed] = useState<number>(() => {
    const stored = localStorage.getItem('pm_daily')
    if (!stored) return 0
    const { date, count } = JSON.parse(stored)
    if (date !== new Date().toDateString()) return 0
    return count
  })

  const saveUsage = (n: number) => {
    localStorage.setItem('pm_daily', JSON.stringify({ date: new Date().toDateString(), count: n }))
    setDailyUsed(n)
  }

  const toggleMood = (id: string) => {
    setMoods(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])
  }

  const generate = async (isBust = false) => {
    if (moods.length === 0 || !subject) return
    setLoading(true)
    setError(null)

    const attempt = async (retry: boolean): Promise<ParsedPattern> => {
      try {
        const { imageBase64 } = await generatePattern({ mood: moods, subject, size, bust: isBust || retry })
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
      const moodLabels = moods.map(id => t.moods.find(m => m.id === id)?.label ?? id).join(', ')
      const subjectLabel = t.subjects.find(s => s.id === subject)?.label ?? subject
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

  const canGenerate = moods.length > 0 && subject !== null && !rateLimited

  if (loading) return <LoadingScreen />

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-10 gap-8">
      <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '2rem', color: '#2D3047' }}>
        {t.tagPickerTitle}
      </h1>

      {/* Mood */}
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

      {/* Subject */}
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

      {/* Size */}
      <div className="w-full max-w-xl">
        <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.2rem', color: '#2D3047', marginBottom: 12 }}>
          {t.tagSizeLabel}
        </p>
        <div className="flex gap-3">
          {t.sizes.map(s => (
            <button
              key={s.id}
              onClick={() => setSize(s.id as 'small' | 'portrait' | 'square' | 'large')}
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
