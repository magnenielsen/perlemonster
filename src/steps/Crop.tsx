import { useRef, useState, useEffect, useCallback } from 'react'
import { t } from '../i18n/no'

interface CropProps {
  imageDataUrl: string
  onCrop: (canvas: HTMLCanvasElement) => void
  onBack: () => void
}

const PREVIEW_SIZE = 400 // display container px

interface Box { x: number; y: number; size: number }

export function Crop({ imageDataUrl, onCrop, onBack }: CropProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [imgScale, setImgScale] = useState({ w: 1, h: 1, offX: 0, offY: 0 }) // how img fits in preview
  const [box, setBox] = useState<Box>({ x: 0.1, y: 0.1, size: 0.8 }) // normalized [0,1] relative to preview area
  const [dragging, setDragging] = useState<'move' | 'resize' | null>(null)
  const dragStart = useRef({ mx: 0, my: 0, bx: 0, by: 0, bs: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      // Fit image into PREVIEW_SIZE × PREVIEW_SIZE keeping aspect ratio
      const scale = Math.min(PREVIEW_SIZE / img.width, PREVIEW_SIZE / img.height)
      const dw = img.width * scale, dh = img.height * scale
      const offX = (PREVIEW_SIZE - dw) / 2, offY = (PREVIEW_SIZE - dh) / 2
      setImgScale({ w: dw, h: dh, offX, offY })
      // Initial crop box: largest centred square within image rect
      const sq = Math.min(dw, dh)
      const cx = offX + (dw - sq) / 2
      const cy = offY + (dh - sq) / 2
      setBox({ x: cx / PREVIEW_SIZE, y: cy / PREVIEW_SIZE, size: sq / PREVIEW_SIZE })
      // Draw
      const canvas = canvasRef.current!
      canvas.width = PREVIEW_SIZE
      canvas.height = PREVIEW_SIZE
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
      ctx.drawImage(img, offX, offY, dw, dh)
      setReady(true)
    }
    img.src = imageDataUrl
  }, [imageDataUrl])

  // Redraw overlay
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgRef.current || !ready) return
    const ctx = canvas.getContext('2d')!
    const { w, h, offX, offY } = imgScale
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
    ctx.drawImage(imgRef.current, offX, offY, w, h)
    // Darken outside crop box
    const bx = box.x * PREVIEW_SIZE, by = box.y * PREVIEW_SIZE
    const bs = box.size * PREVIEW_SIZE
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
    ctx.clearRect(bx, by, bs, bs)
    ctx.drawImage(imgRef.current, offX, offY, w, h)
    ctx.clearRect(bx, by, bs, bs)
    const savedOp = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'source-over'
    // Re-draw image inside crop
    ctx.save()
    ctx.beginPath(); ctx.rect(bx, by, bs, bs); ctx.clip()
    ctx.drawImage(imgRef.current, offX, offY, w, h)
    ctx.restore()
    // Border
    ctx.strokeStyle = '#FF6B6B'
    ctx.lineWidth = 2
    ctx.strokeRect(bx, by, bs, bs)
    // Resize handle
    ctx.fillStyle = '#FF6B6B'
    ctx.fillRect(bx + bs - 10, by + bs - 10, 10, 10)
    ctx.globalCompositeOperation = savedOp
  }, [box, imgScale, ready])

  const getRelPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return {
      x: (clientX - rect.left) * (PREVIEW_SIZE / rect.width),
      y: (clientY - rect.top) * (PREVIEW_SIZE / rect.height),
    }
  }

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const pos = getRelPos(e)
    const bx = box.x * PREVIEW_SIZE, by = box.y * PREVIEW_SIZE, bs = box.size * PREVIEW_SIZE
    const inHandle = pos.x >= bx + bs - 14 && pos.y >= by + bs - 14
    const inBox = pos.x >= bx && pos.x <= bx + bs && pos.y >= by && pos.y <= by + bs
    if (inHandle) {
      setDragging('resize')
      dragStart.current = { mx: pos.x, my: pos.y, bx: box.x, by: box.y, bs: box.size }
    } else if (inBox) {
      setDragging('move')
      dragStart.current = { mx: pos.x, my: pos.y, bx: box.x, by: box.y, bs: box.size }
    }
  }, [box])

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return
    e.preventDefault()
    const pos = getRelPos(e)
    const { mx, my, bx, by: bby, bs } = dragStart.current
    const dx = (pos.x - mx) / PREVIEW_SIZE, dy = (pos.y - my) / PREVIEW_SIZE
    if (dragging === 'move') {
      const nx = Math.max(0, Math.min(1 - bs, bx + dx))
      const ny = Math.max(0, Math.min(1 - bs, bby + dy))
      setBox({ x: nx, y: ny, size: bs })
    } else {
      const newSize = Math.max(0.1, Math.min(1 - bx, Math.min(1 - bby, bs + Math.min(dx, dy))))
      setBox({ x: bx, y: bby, size: newSize })
    }
  }, [dragging])

  const handlePointerUp = useCallback(() => setDragging(null), [])

  const handleCrop = useCallback(() => {
    const img = imgRef.current
    if (!img) return
    const { w, offX, offY } = imgScale
    const bx = box.x * PREVIEW_SIZE - offX, by = box.y * PREVIEW_SIZE - offY
    const bs = box.size * PREVIEW_SIZE
    // Map box back to original image coords
    const scale = img.width / w
    const srcX = bx * scale, srcY = by * scale, srcSize = bs * scale
    const out = document.createElement('canvas')
    out.width = 29; out.height = 29
    const ctx = out.getContext('2d')!
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, 29, 29)
    onCrop(out)
  }, [box, imgScale, onCrop])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 gap-6">
      <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: '2rem', color: '#2D3047' }}>
        {t.cropTitle}
      </h1>
      <p style={{ color: '#888', fontFamily: "'Nunito', sans-serif" }}>{t.cropHint}</p>

      <div
        ref={containerRef}
        style={{ position: 'relative', width: PREVIEW_SIZE, height: PREVIEW_SIZE, borderRadius: 16, overflow: 'hidden', cursor: dragging === 'resize' ? 'nwse-resize' : dragging === 'move' ? 'grabbing' : 'default', touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          style={{ display: 'block', maxWidth: '100%' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
      </div>

      <div className="flex gap-4">
        <button className="btn-secondary" onClick={onBack}>{t.cropBack}</button>
        <button className="btn-primary" onClick={handleCrop} disabled={!ready}>{t.cropNext}</button>
      </div>
    </div>
  )
}
