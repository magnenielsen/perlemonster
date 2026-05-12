import { jsPDF } from 'jspdf'
import type { PerlerColor } from './palette'
import type { Grid } from './quantize'

const GRID_SIZE = 29

function contrastColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  // WCAG luminance
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 140 ? '#000000' : '#FFFFFF'
}

export function generatePDF(grid: Grid, palette: PerlerColor[], title: string): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const pageW = 210, pageH = 297
  const margin = 12

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor('#2D3047')
  doc.text(title || 'Perlemonster', pageW / 2, margin + 6, { align: 'center' })

  // Date
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#888888')
  const dateStr = new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })
  doc.text(dateStr, pageW / 2, margin + 12, { align: 'center' })

  // Grid dimensions — fill most of the width
  const availW = pageW - margin * 2
  const cellSizePt = availW / GRID_SIZE
  const gridTop = margin + 18
  const gridLeft = margin

  // Draw grid
  doc.setLineWidth(0.15)
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const idx = grid[row][col]
      const color = palette[idx]
      if (!color) continue
      const x = gridLeft + col * cellSizePt
      const y = gridTop + row * cellSizePt

      // Fill cell
      const h = color.hex
      doc.setFillColor(
        parseInt(h.slice(1, 3), 16),
        parseInt(h.slice(3, 5), 16),
        parseInt(h.slice(5, 7), 16),
      )
      doc.setDrawColor(200, 200, 200)
      doc.rect(x, y, cellSizePt, cellSizePt, 'FD')

      // Legend number in cell (A=1, B=2, ...)
      const label = String.fromCharCode(65 + idx)
      doc.setFontSize(cellSizePt * 1.4)
      const textColor = contrastColor(color.hex)
      doc.setTextColor(textColor)
      doc.text(label, x + cellSizePt / 2, y + cellSizePt * 0.72, { align: 'center' })
    }
  }

  // Legend below grid
  const legendTop = gridTop + GRID_SIZE * cellSizePt + 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#2D3047')
  doc.text('Farger:', margin, legendTop)

  // Count beads per colour
  const counts = new Map<number, number>()
  for (const row of grid) for (const v of row) counts.set(v, (counts.get(v) ?? 0) + 1)

  const colW = (pageW - margin * 2) / 4
  palette.forEach((color, i) => {
    const col = i % 4
    const rowIdx = Math.floor(i / 4)
    const lx = margin + col * colW
    const ly = legendTop + 6 + rowIdx * 8

    // Colour swatch
    const h = color.hex
    doc.setFillColor(parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16))
    doc.setDrawColor(180,180,180)
    doc.rect(lx, ly - 3.5, 4, 4, 'FD')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#2D3047')
    const letter = String.fromCharCode(65 + i)
    const count = counts.get(i) ?? 0
    doc.text(`${letter} ${color.name} (${count})`, lx + 5, ly)
  })

  // Footer
  doc.setFontSize(7)
  doc.setTextColor('#AAAAAA')
  doc.text('Bildene dine forlater aldri datamaskinen din. • perlemonster.no', pageW / 2, pageH - 6, { align: 'center' })

  doc.save(`${title || 'perlemonster'}.pdf`)
}
