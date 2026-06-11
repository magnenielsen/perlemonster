# Perlemonster — Project Documentation

A web app that lets kids create bead patterns (perler/hama beads) either from their own photos or from AI-generated illustrations. Built as a lightweight SPA with a single serverless API function.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Fast dev loop, strict typing catches bugs before deploy |
| Styling | Tailwind CSS 4 | Utility-first, no build config needed |
| Backend | Vercel Serverless Function (`api/generate.ts`) | Zero infra, scales to zero, free tier covers hobby use |
| Image generation | Replicate — retro-diffusion/rd-plus | Native pixel art model, generates grid-aligned images at exact bead dimensions |
| PDF export | jsPDF (client-side) | No server needed, works offline |

---

## Two User Paths

### Path A — Photo Upload
1. User uploads a photo (JPG/PNG/WebP, max 20 MB)
2. Crop step: user draws a rectangle over the subject
3. Convert step: canvas is quantized to a bead grid using k-means clustering in CIE Lab color space
4. Edit step: user paints individual beads
5. Export: PDF with bead-by-bead instructions and color legend

### Path B — AI Generation
1. User picks mood tags (sweet, funny, spooky, cool) and a subject (animal, monster, food, nature, robot)
2. User picks grid size (portrait 13×21, square 19×19, large 29×29)
3. Prompt is built server-side and sent to Flux Schnell via Replicate API
4. Generated image is returned as base64 to the client
5. Client runs the same quantize pipeline as Path A
6. Edit + Export as above

---

## The AI Generation Pipeline

### Prompt Strategy
The single most impactful lever. Key discoveries through iteration:

- **Chibi/kawaii framing** works far better than "pixel art" alone. Flux has seen enormous amounts of chibi art and generates it reliably.
- **Exaggerated features matter**: prompt explicitly for "huge eyes taking up one third of the face" and "thick bold mouth at least 3 pixels tall". Thin lines disappear during quantization.
- **Size-aware framing**: small grids need face-only close-ups; full bodies only work at 29×29 where there are enough beads to show detail.
- **Solid background color**: prompting for a medium gray background gives every bead a purpose. White backgrounds created wasted space.
- **Flat colors + bold outline**: critical for clean quantization. "No shading, no gradients, no anti-aliasing" must be stated explicitly.

Current prompt structure:
```
[mood] [subject description]. Chibi kawaii pixel art sprite.
[size-specific framing].
Solid medium gray background.
[complexity hint: number of flat color regions].
Huge expressive eyes. Thick bold mouth.
Very bold black outline. Flat solid colors only, no shading, no gradients.
Designed for kids. Classic cute cartoon style.
```

### Image Processing Pipeline
```
rd-plus image (base64, generated at 4× bead grid size)
  → HTML Canvas (scale up with imageSmoothingEnabled = false — keeps pixel edges sharp)
  → Canvas size: cols×16 × rows×16 px
  → quantizeImageData(imageData, colorCount, 'skarp', rows, cols)
  → { grid, palette }
```
No bounding-box crop needed — rd-plus generates native pixel art that fills the frame.

### Quantization
- Area-averaging downsampling: each bead cell averages all pixels in its area
- k-means clustering in CIE Lab color space (perceptually uniform)
- Each cluster is matched to the nearest real Perler bead color from a 60-color palette
- Color counts by grid size: 8 for portrait/square, 15 for large

### Color Counts (valid values: 8 | 15 | 30)
| Size | Grid | Colors |
|---|---|---|
| Portrait | 13×21 | 8 |
| Square | 19×19 | 8 |
| Large | 29×29 | 15 |

---

## Key Lessons Learned

1. **Crop before quantize, not after.** The subject needs to fill the working canvas. Flux generates subjects that are 30-50% of image size even when prompted to fill the frame. Background-aware cropping is essential.

2. **Background color is part of the design.** Early versions used white background and cropped to just the subject. Better results came from using a colored background (gray) and keeping a thin border — matches how real bead pattern templates are designed.

3. **Small grids (11×11) are not viable for AI-generated content.** Removed entirely. 19×19 is the practical minimum.

4. **Chibi > pixel art as a prompt style.** "Pixel art" produced noisy, detailed images. "Chibi kawaii" produced simple round shapes with large features that quantize cleanly.

5. **Mouth visibility requires explicit prompting.** Chibi mouths are naturally thin curves. "Thick bold mouth, at least 3 pixels tall" is necessary for the mouth to survive quantization.

6. **In-memory rate limiting does not work on serverless.** Each cold start creates a fresh instance with empty state. Use Replicate spend caps as a backstop instead.

---

## Security

- CORS: origin check via `ALLOWED_ORIGIN` env var (set to production URL in Vercel)
- Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`
- Input validation: mood array capped at 4, all values allowlisted, size validated against known map
- Replicate response validation: URL must be `https://`, response must have `image/` content-type
- User photos never leave the device (all processing is client-side canvas)

---

## Applying This to a Coloring Book Generator

A coloring book page generator shares the same core loop (mood + subject → Flux → process → printable PDF) but the processing step is completely different.

### What changes

Instead of quantizing to a bead grid, you need **clean black outline art** on a white background.

The pipeline would be:
```
Flux image
  → Crop (same background-aware crop as above)
  → Convert to line art (see options below)
  → Render to PDF as printable A4 page
```

### Line art extraction options

**Option 1 — Prompt Flux for line art directly**
Ask Flux for "coloring book page, black outlines only, white background, no fill, bold thick lines". Flux can generate reasonable coloring pages directly. Simplest approach, zero extra processing.

**Option 2 — Edge detection on the generated image**
Generate the colored chibi image, then run Canny edge detection on the client (via a canvas filter or a small WASM library). Gives cleaner, more consistent outlines than asking Flux directly. Can be done entirely in the browser.

**Option 3 — Posterize + threshold**
Quantize to very few colors (2-3), then threshold to black/white. Works well for chibi art since the flat colors mean edges are already sharp. Can be done with canvas pixel manipulation — no extra libraries.

**Option 4 — Replicate img2img or dedicated model**
Use a dedicated line art / sketch model on Replicate (e.g. `jagilley/controlnet-scribble`) to convert the Flux output. Most reliable results, but adds a second API call and latency.

### Recommended approach for a first version
Start with Option 1 (prompt Flux directly for line art). If quality is inconsistent, layer in Option 3 (posterize + threshold) as a post-processing step on the client. Option 2 or 4 can come later if needed.

### What stays the same
- Tag picker UI (mood + subject)
- Vercel serverless function structure
- Rate limiting + security headers
- PDF export (jsPDF, client-side)
- Mascot / brand feel

### What is different
- No quantize step
- No bead grid or color palette
- Output is A4 portrait, black lines on white
- PDF should have the colored reference image on one side and the outline on the other (or just the outline)
- Possibly add a title field so kids can write their name on the page

### Suggested grid sizes → page complexity
| Tag | What it means for coloring |
|---|---|
| Portrait | Simple face, few lines — good for younger kids |
| Square | More detail, still manageable |
| Large | Full scene, more lines — better for older kids |

---

## File Structure

```
perlemonster/
  api/
    generate.ts          # Serverless function: validates input, calls Replicate, returns base64
  src/
    steps/
      Home.tsx           # Landing page, choose path A or B
      Upload.tsx         # File picker + drag-and-drop
      Crop.tsx           # Canvas crop tool
      Convert.tsx        # Settings + quantize for photo path
      TagPicker.tsx      # Mood/subject/size picker + AI generation + quantize
      Edit.tsx           # Bead-by-bead editor with full 60-color palette
      Export.tsx         # PDF generation + share link + wake lock
    lib/
      ai.ts              # Fetch wrapper for /api/generate
      grid.ts            # ParsedPattern type
      quantize.ts        # k-means + area averaging + Perler color matching
      palette.ts         # 60 Perler bead colors with CIE Lab values
      share.ts           # URL fragment encode/decode for sharing patterns
      pdf.ts             # jsPDF bead pattern PDF builder
      useWakeLock.ts     # Screen Wake Lock API hook
    components/
      BeadGrid.tsx        # Renders the interactive bead grid
      Mascot.tsx          # Animated mascot character
    i18n/
      no.ts              # All UI strings in Norwegian
  vercel.json            # Build config, security headers, function settings
```
