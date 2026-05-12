import { t } from '../i18n/no'
import { Mascot } from '../components/Mascot'
import { PixelIcon, PHOTO_PIXELS, BULB_PIXELS } from '../components/PixelIcon'

interface HomeProps {
  onPathA: () => void
  onPathB: () => void
}

export function Home({ onPathA, onPathB }: HomeProps) {
  return (
    <div className="min-h-screen pixel-bg flex flex-col items-center justify-center px-4 py-10 gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <Mascot mood="idle" size={110} />
        <h1
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '1.4rem', color: '#9B72CB', lineHeight: 1.4 }}
          className="text-center mt-2"
        >
          Perle<br />monster
        </h1>
        <p style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.3rem', color: '#2D3047' }}>
          {t.tagline}
        </p>
      </div>

      {/* Path cards */}
      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
        <button
          onClick={onPathA}
          className="card flex-1 flex flex-col items-center gap-4 p-8 hover:scale-105 transition-transform cursor-pointer text-left border-2 border-transparent hover:border-coral"
          style={{ borderRadius: '1.5rem' }}
        >
          <PixelIcon grid={PHOTO_PIXELS} cellSize={6} />
          <div>
            <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.5rem', color: '#2D3047', marginBottom: 4 }}>
              {t.pathATitle}
            </h2>
            <p style={{ color: '#666', fontSize: '0.95rem' }}>{t.pathADesc}</p>
          </div>
          <span className="btn-primary w-full text-center" style={{ pointerEvents: 'none' }}>
            Velg bilde →
          </span>
        </button>

        <button
          onClick={onPathB}
          className="card flex-1 flex flex-col items-center gap-4 p-8 hover:scale-105 transition-transform cursor-pointer text-left border-2 border-transparent hover:border-lavender"
          style={{ borderRadius: '1.5rem' }}
        >
          <PixelIcon grid={BULB_PIXELS} cellSize={6} />
          <div>
            <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '1.5rem', color: '#2D3047', marginBottom: 4 }}>
              {t.pathBTitle}
            </h2>
            <p style={{ color: '#666', fontSize: '0.95rem' }}>{t.pathBDesc}</p>
          </div>
          <span className="btn-sky w-full text-center" style={{ pointerEvents: 'none' }}>
            Velg stemning →
          </span>
        </button>
      </div>

      <footer style={{ color: '#aaa', fontSize: '0.8rem', textAlign: 'center', marginTop: 16 }}>
        {t.footer}
      </footer>
    </div>
  )
}
