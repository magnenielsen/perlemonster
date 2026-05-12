// Floyd–Steinberg dithering applied to raw ImageData (RGBA)
// Modifies a copy of the data in-place and returns it
export function floydSteinberg(imageData: ImageData): ImageData {
  const { width, height } = imageData
  // Work on a float buffer to accumulate errors
  const buf = new Float32Array(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    buf[i * 3]     = imageData.data[i * 4]
    buf[i * 3 + 1] = imageData.data[i * 4 + 1]
    buf[i * 3 + 2] = imageData.data[i * 4 + 2]
  }

  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      const oldR = buf[i], oldG = buf[i+1], oldB = buf[i+2]
      // Quantize to nearest 32-step (softens for dithering; actual Perler snap happens later)
      const newR = Math.round(oldR / 32) * 32
      const newG = Math.round(oldG / 32) * 32
      const newB = Math.round(oldB / 32) * 32
      buf[i] = newR; buf[i+1] = newG; buf[i+2] = newB

      const eR = oldR - newR, eG = oldG - newG, eB = oldB - newB

      const spread = (dx: number, dy: number, factor: number) => {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || nx >= width || ny >= height) return
        const j = (ny * width + nx) * 3
        buf[j]   += eR * factor
        buf[j+1] += eG * factor
        buf[j+2] += eB * factor
      }

      spread(1, 0, 7/16)
      spread(-1, 1, 3/16)
      spread(0, 1, 5/16)
      spread(1, 1, 1/16)
    }
  }

  const out = new ImageData(width, height)
  for (let i = 0; i < width * height; i++) {
    out.data[i * 4]     = clamp(buf[i * 3])
    out.data[i * 4 + 1] = clamp(buf[i * 3 + 1])
    out.data[i * 4 + 2] = clamp(buf[i * 3 + 2])
    out.data[i * 4 + 3] = 255
  }
  return out
}
