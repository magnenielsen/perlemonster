import { useRef, useState, useCallback } from 'react'
import { t } from '../i18n/no'

interface UploadProps {
  onImage: (dataUrl: string) => void
  onBack: () => void
}

export function Upload({ onImage, onBack }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')

  const loadFile = useCallback((file: File) => {
    setError('')
    if (!file.type.match(/image\/(jpeg|png|webp)/)) {
      setError('Bare JPG, PNG og WebP er støttet.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Bildet er for stort. Maks 20 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => onImage(reader.result as string)
    reader.readAsDataURL(file)
  }, [onImage])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }, [loadFile])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-6">
      <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '2rem', color: '#2D3047' }}>
        {t.uploadTitle}
      </h1>

      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="card flex flex-col items-center justify-center gap-4 cursor-pointer transition-all"
        style={{
          width: '100%',
          maxWidth: 480,
          minHeight: 280,
          border: `2.5px dashed ${isDragging ? '#FF6B6B' : '#d1d5db'}`,
          background: isDragging ? '#FFF0F0' : 'white',
          borderRadius: '1.5rem',
        }}
      >
        <div className="text-6xl">{isDragging ? '🎯' : '📁'}</div>
        <p style={{ color: '#888', textAlign: 'center', fontFamily: "'Nunito', sans-serif" }}>
          {t.uploadDrop}{' '}
          <span style={{ color: '#FF6B6B', fontWeight: 700 }}>{t.uploadBrowse}</span>
        </p>
        <p style={{ color: '#bbb', fontSize: '0.85rem' }}>{t.uploadHint}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f) }}
      />

      {error && (
        <p style={{ color: '#EE4B2B', fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>
          ⚠️ {error}
        </p>
      )}

      <button className="btn-secondary" onClick={onBack}>
        {t.uploadBack}
      </button>
    </div>
  )
}
