import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_MOODS = new Set(['søt', 'morsom', 'skummel', 'kul'])
const VALID_SUBJECTS = new Set(['dyr', 'monster', 'mat', 'natur', 'robot', 'flagg', 'bunad', 'is', 'korps', 'ballong'])

const SIZE_MAP: Record<string, { rows: number; cols: number; aspect: string }> = {
  portrait: { rows: 21, cols: 13, aspect: '2:3' },
  square:   { rows: 19, cols: 19, aspect: '1:1' },
  large:    { rows: 29, cols: 29, aspect: '1:1' },
}

const SUBJECT_PROMPTS: Record<string, string> = {
  dyr:     'chibi animal face portrait, perfectly round head, two giant black dot eyes, thick bold U-shaped smile',
  monster: 'chibi monster face portrait, round head, giant googly eyes, wide open grinning mouth showing thick bold teeth',
  mat:     'chibi food face portrait, round shape, two big dot eyes, thick bold curved happy smile',
  natur:   'chibi flower face portrait, round center, big eyes, thick bold smile',
  robot:   'chibi robot face portrait, square head, large circular eyes, thick bold rectangular smile',
  // 17. mai
  flagg:   'chibi Norwegian flag, bold red white and blue cross, simple flat graphic, fills the frame',
  bunad:   'chibi character face wearing a colorful Norwegian bunad folk costume with embroidery, big round head, huge eyes, thick smile',
  is:      'chibi ice cream cone face portrait, two big dot eyes on the scoop, thick bold smile, bright cheerful colors',
  korps:   'chibi character face portrait wearing a marching band uniform and hat, huge eyes, rosy cheeks, thick smile',
  ballong: 'chibi round balloon face portrait, big cute dot eyes, thick bold smile, bright single color balloon',
}

const MOOD_PROMPTS: Record<string, string> = {
  søt:     'sweet and adorable',
  morsom:  'funny and goofy',
  skummel: 'spooky and wide-eyed',
  kul:     'cool and confident',
}

const FRAMING_BY_SIZE: Record<string, string> = {
  portrait: 'Head and upper chest only. No arms, no body below chest. Face fills top three-quarters of frame.',
  square:   'Face portrait only. Round face fills the entire frame. Cropped at chin and top of head. Absolutely no body, no arms, no hands visible.',
  large:    'Full chibi body. Head takes up at least half the total height. Face features clearly visible.',
}

const COMPLEXITY_BY_SIZE: Record<string, string> = {
  portrait: '3 or 4 flat color regions.',
  square:   '4 or 5 flat color regions.',
  large:    '5 or 6 flat color regions.',
}

function buildFluxPrompt(moods: string[], subject: string, size: string): string {
  const moodDesc = moods.map(m => MOOD_PROMPTS[m] ?? m).join(', ')
  const subjectDesc = SUBJECT_PROMPTS[subject] ?? subject
  const framing = FRAMING_BY_SIZE[size] ?? FRAMING_BY_SIZE.square
  const complexity = COMPLEXITY_BY_SIZE[size] ?? COMPLEXITY_BY_SIZE.square
  return (
    `${moodDesc} ${subjectDesc}. Chibi kawaii pixel art sprite. ` +
    `${framing} ` +
    `Solid medium gray background. ` +
    `${complexity} ` +
    `Huge expressive eyes taking up one third of the face. Mouth is thick and bold, at least 3 pixels tall, clearly visible. ` +
    `Very bold black outline. Flat solid colors only, no shading, no gradients, no anti-aliasing. ` +
    `Designed for kids. Classic cute cartoon style.`
  )
}

// --- Rate limiter ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const MAX_PER_DAY = parseInt(process.env.RATE_LIMIT_PER_DAY ?? '10', 10)

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 })
    return { allowed: true, remaining: MAX_PER_DAY - 1 }
  }
  if (entry.count >= MAX_PER_DAY) return { allowed: false, remaining: 0 }
  entry.count++
  return { allowed: true, remaining: MAX_PER_DAY - entry.count }
}

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true // non-browser clients (curl etc.) — acceptable
  const allowed = process.env.ALLOWED_ORIGIN
  if (!allowed) return true // no restriction configured — allow all
  return origin === allowed || /^https?:\/\/localhost(:\d+)?$/.test(origin)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // CORS origin check — blocks other websites from draining your Replicate quota
  const origin = req.headers['origin'] as string | undefined
  if (!isOriginAllowed(origin)) return res.status(403).json({ error: 'Forbidden' })

  const { mood, subject, size = 'square' } = req.body ?? {}

  if (!Array.isArray(mood) || mood.length === 0 || typeof subject !== 'string') {
    return res.status(400).json({ error: 'Invalid input' })
  }
  if (mood.length > 4) return res.status(400).json({ error: 'Too many moods' })
  const invalidMood = mood.find((m: unknown) => typeof m !== 'string' || !VALID_MOODS.has(m))
  if (invalidMood !== undefined) return res.status(400).json({ error: 'Invalid mood' })
  if (!VALID_SUBJECTS.has(subject)) return res.status(400).json({ error: 'Invalid subject' })
  if (typeof size !== 'string' || !SIZE_MAP[size]) return res.status(400).json({ error: 'Invalid size' })

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? '0.0.0.0'
  const { allowed, remaining } = checkRateLimit(ip)
  if (!allowed) return res.status(429).json({ error: 'rate_limit', remaining: 0 })

  const { aspect } = SIZE_MAP[size]
  const prompt = buildFluxPrompt(mood as string[], subject, size)

  try {
    const replicateRes = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait',
        },
        body: JSON.stringify({
          input: {
            prompt,
            num_outputs: 1,
            output_format: 'png',
            aspect_ratio: aspect,
            num_inference_steps: 4,
            go_fast: true,
          },
        }),
      }
    )

    const prediction = await replicateRes.json() as { status: string; output?: string[] }

    if (prediction.status !== 'succeeded' || !prediction.output?.[0]) {
      throw new Error(`Replicate status: ${prediction.status}`)
    }

    const imageUrl = prediction.output[0]
    if (!imageUrl.startsWith('https://')) throw new Error('Unexpected image URL')
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`)
    const contentType = imgRes.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) throw new Error(`Unexpected content-type: ${contentType}`)
    const imgBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')

    res.setHeader('X-Rate-Limit-Remaining', remaining.toString())
    return res.status(200).json({ imageBase64: `data:image/png;base64,${base64}` })
  } catch (e) {
    console.error('generate error', e)
    return res.status(500).json({ error: 'generation_failed' })
  }
}
