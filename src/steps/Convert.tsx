import { useState } from 'react'
import { t } from '../i18n/no'
import { floydSteinberg } from '../lib/dither'
import { quantizeImageData } from '../lib/quantize'
import type { QuantizeResult } from '../lib/quantize'
import { Mascot } from '../components/Mascot'

interface ConvertProps {
  croppedCanvas: HTMLCanvasElement
  onDone: (result: QuantizeResult) => void
  onBack: () => void
}

export function Convert({ croppedCanvas, onDone, onBack }: ConvertProps) {
  const [colorCount, setColorCount] = useState<8 | 15 | 30>(8)
  const [style, setStyle] = useState<'glatt' | 'skarp'>('skarp')
  const [size, setSize] = useState<'small' | 'portrait' | 'square' | 'large'>('small')
  const [converting, setConverting] = useState(false)

  const SIZE_MAP = {
    small:    { rows: 11, cols: 11 },
    portrait: { rows: 21, cols: 13 },
    square:   { rows: 19, cols: 19 },
    large:    { rows: 29, cols: 29 },
  }

  const handleConvert = async () => {
    setConverting(true)
    await new Promise(r => setTimeout(r, 50))

    const ctx = croppedCanvas.getContext('2d')!
    let imageData = ctx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height)

    if (style === 'glatt') {
      imageData = floydSteinberg(imageData)
    }

    const result = quantizeImageData(imageData, colorCount, style, SIZE_MAP[size].rows, SIZE_MAP[size].cols)
    setConverting(false)
    onDone(result)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-8">
      {converting ? (
        <div className="flex flex-col items-center gap-4">
          <Mascot mood="drawing" size={130} />
          <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.4rem', color: '#9B72CB' }}>
            {t.convertConverting}
          </p>
        </div>
      ) : (
        <>
          <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '2rem', color: '#2D3047' }}>
            {t.convertTitle}
          </h1>

          <div className="card flex flex-col gap-6" style={{ width: '100%', maxWidth: 440 }}>
            {/* Size */}
            <div>
              <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.1rem', color: '#2D3047', marginBottom: 10 }}>
                {t.tagSizeLabel}
              </p>
              <div className="flex gap-3">
                {t.sizes.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSize(s.id as 'small' | 'medium' | 'large')}
                    className="tag-btn flex-1 flex flex-col items-center gap-1"
                    style={size === s.id ? { borderColor: '#FF6B6B', background: '#FFF0F0', color: '#FF6B6B' } : {}}
                  >
                    <span>{s.label}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 400 }}>{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Color count */}
            <div>
              <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.1rem', color: '#2D3047', marginBottom: 10 }}>
                {t.convertColors}
              </p>
              <div className="flex gap-3">
                {([8, 15, 30] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setColorCount(n)}
                    className="tag-btn flex-1"
                    style={colorCount === n ? { borderColor: '#FF6B6B', background: '#FFF0F0', color: '#FF6B6B' } : {}}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.1rem', color: '#2D3047', marginBottom: 10 }}>
                {t.convertStyle}
              </p>
              <div className="flex gap-3">
                {(['glatt', 'skarp'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className="tag-btn flex-1 flex-col"
                    style={style === s ? { borderColor: '#FF6B6B', background: '#FFF0F0', color: '#FF6B6B' } : {}}
                  >
                    <span>{s === 'glatt' ? t.convertGlatt : t.convertSkarp}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7, fontWeight: 400 }}>
                      {s === 'glatt' ? t.convertGlattDesc : t.convertSkarpDesc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button className="btn-secondary" onClick={onBack}>{t.convertBack}</button>
            <button className="btn-primary" onClick={handleConvert}>{t.convertGo}</button>
          </div>
        </>
      )}
    </div>
  )
}
