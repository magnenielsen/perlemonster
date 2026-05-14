import { useState, useEffect } from 'react'
import { Home } from './steps/Home'
import { Upload } from './steps/Upload'
import { Crop } from './steps/Crop'
import { Convert } from './steps/Convert'
import { TagPicker } from './steps/TagPicker'
import { Edit } from './steps/Edit'
import { Export } from './steps/Export'
import { decodePattern } from './lib/share'
import type { PerlerColor } from './lib/palette'
import type { Grid } from './lib/quantize'
import type { ParsedPattern } from './lib/grid'

type Step = 'home' | 'upload' | 'crop' | 'convert' | 'tagpicker' | 'edit' | 'export'

interface AppState {
  step: Step
  imageDataUrl: string | null
  croppedCanvas: HTMLCanvasElement | null
  grid: Grid | null
  palette: PerlerColor[]
  patternTitle: string
  patternSourceImage: string | null
  // AI path metadata for "Gi meg en ny"
  aiMoods: string[]
  aiSubject: string | null
}

const INITIAL: AppState = {
  step: 'home',
  imageDataUrl: null,
  croppedCanvas: null,
  grid: null,
  palette: [],
  patternTitle: '',
  patternSourceImage: null,
  aiMoods: [],
  aiSubject: null,
}

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL)

  const go = (patch: Partial<AppState>) => setState(s => ({ ...s, ...patch }))

  // On mount: check URL fragment for shared pattern
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const decoded = decodePattern(hash)
    if (decoded) {
      setState(s => ({
        ...s,
        step: 'edit',
        grid: decoded.grid,
        palette: decoded.palette,
        patternTitle: decoded.title ?? '',
      }))
    }
  }, [])

  const { step } = state

  return (
    <div>
      {step === 'home' && (
        <Home
          onPathA={() => go({ step: 'upload' })}
          onPathB={() => go({ step: 'tagpicker' })}
        />
      )}

      {step === 'upload' && (
        <Upload
          onImage={dataUrl => go({ step: 'crop', imageDataUrl: dataUrl })}
          onBack={() => go({ step: 'home' })}
        />
      )}

      {step === 'crop' && state.imageDataUrl && (
        <Crop
          imageDataUrl={state.imageDataUrl}
          onCrop={canvas => go({ step: 'convert', croppedCanvas: canvas })}
          onBack={() => go({ step: 'upload' })}
        />
      )}

      {step === 'convert' && state.croppedCanvas && (
        <Convert
          croppedCanvas={state.croppedCanvas}
          onDone={result => go({ step: 'edit', grid: result.grid, palette: result.palette })}
          onBack={() => go({ step: 'crop' })}
        />
      )}

      {step === 'tagpicker' && (
        <TagPicker
          onDone={(pattern: ParsedPattern) =>
            go({
              step: 'edit',
              grid: pattern.grid,
              palette: pattern.palette,
              patternTitle: pattern.title ?? '',
              patternSourceImage: pattern.sourceImage ?? null,
            })
          }
          onBack={() => go({ step: 'home' })}
        />
      )}

      {step === 'edit' && state.grid && (
        <Edit
          grid={state.grid}
          palette={state.palette}
          sourceImage={state.patternSourceImage || undefined}
          onDone={(grid, palette) => go({ step: 'export', grid, palette })}
          onBack={() => go({ step: state.croppedCanvas ? 'convert' : 'tagpicker' })}
          onNewIdea={state.aiSubject ? () => go({ step: 'tagpicker' }) : undefined}
        />
      )}

      {step === 'export' && state.grid && (
        <Export
          grid={state.grid}
          palette={state.palette}
          initialTitle={state.patternTitle}
          onBack={() => go({ step: 'edit' })}
          onNew={() => setState(INITIAL)}
        />
      )}
    </div>
  )
}
