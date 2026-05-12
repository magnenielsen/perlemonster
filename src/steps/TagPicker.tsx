import { useState } from 'react'
import { t } from '../i18n/no'
import { generatePattern, RateLimitError } from '../lib/ai'
import type { ParsedPattern } from '../lib/grid'
import { Mascot } from '../components/Mascot'

interface TagPickerProps {
  onDone: (result: ParsedPattern) => void
  onBack: () => void
}

const MAX_DAILY = 20

export function TagPicker({ onDone, onBack }: TagPickerProps) {
  const [moods, setMoods] = useState<string[]>([])
  const [subject, setSubject] = useState<string | null>(null)
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
  const [, setBust] = useState(false) // bust cache on "Gi meg en ny"

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
        const result = await generatePattern({ mood: moods, subject, bust: isBust || retry })
        return result
      } catch (e) {
        if (e instanceof RateLimitError) throw e
        if (!retry) return attempt(true)
        throw e
      }
    }

    try {
      const result = await attempt(false)
      const newCount = dailyUsed + 1
      saveUsage(newCount)
      setLoading(false)
      onDone(result)
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Mascot mood="drawing" size={150} />
        <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.5rem', color: '#9B72CB' }}>
          {t.tagGenerating}
        </p>
      </div>
    )
  }

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

      {/* Error */}
      {error && (
        <div className="card" style={{ maxWidth: 440, textAlign: 'center', borderLeft: '4px solid #FF6B6B' }}>
          <p style={{ fontFamily: "'Nunito', sans-serif", color: '#2D3047' }}>{error}</p>
        </div>
      )}

      {/* Daily counter */}
      <p style={{ color: '#aaa', fontSize: '0.85rem' }}>{t.tagCounter(dailyUsed, MAX_DAILY)}</p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <button className="btn-secondary" onClick={onBack}>{t.tagBack}</button>
        <button
          className="btn-primary"
          disabled={!canGenerate}
          onClick={() => { setBust(false); generate(false) }}
        >
          {t.tagGenerate}
        </button>
      </div>
    </div>
  )
}

// "Gi meg en ny" variant — shown in Edit step via a callback
export function NewIdeaButton({ moods, subject, onDone }: { moods: string[]; subject: string; onDone: (p: ParsedPattern) => void }) {
  const [loading, setLoading] = useState(false)

  const handleNew = async () => {
    setLoading(true)
    try {
      const result = await generatePattern({ mood: moods, subject, bust: true })
      onDone(result)
    } catch {}
    setLoading(false)
  }

  return (
    <button className="btn-sunshine" onClick={handleNew} disabled={loading}>
      {loading ? '⏳' : t.tagNew}
    </button>
  )
}
