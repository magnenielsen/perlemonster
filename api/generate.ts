import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_MOODS = new Set(['søt', 'morsom', 'skummel', 'kul'])
const VALID_SUBJECTS = new Set(['dyr', 'monster', 'mat', 'natur', 'robot', 'vm'])

// width/height sent to rd-plus at 4× the bead grid — each 4×4 pixel block = one bead
const SIZE_MAP: Record<string, { rows: number; cols: number; width: number; height: number }> = {
  portrait: { rows: 21, cols: 13, width: 52,  height: 84  },
  square:   { rows: 19, cols: 19, width: 76,  height: 76  },
  large:    { rows: 29, cols: 29, width: 116, height: 116 },
}

const SUBJECT_PROMPTS: Record<string, string> = {
  dyr:     'chibi animal face, round head, huge black dot eyes, rosy cheeks, bold U-shaped smile',
  monster: 'chibi monster face, round head, giant googly eyes, wide open grinning mouth',
  mat:     'chibi food character face, round shape, big dot eyes, bold happy smile',
  natur:   'chibi flower face, round center, big eyes, bold smile',
  robot:   'chibi robot face, square head, large circular eyes, bold rectangular smile',
  vm:      'chibi football player celebrating a goal, wearing colorful jersey and shorts, kicking a football, big round head, huge eyes, bold smile',
}

const MOOD_PROMPTS: Record<string, string> = {
  søt:     'cute and sweet',
  morsom:  'funny and silly',
  skummel: 'spooky and scary',
  kul:     'cool with sunglasses',
}

const FRAMING_BY_SIZE: Record<string, string> = {
  portrait: 'full chibi body from head to toe, centered, character fills most of the frame',
  square:   'full chibi body from head to toe, centered, character fills most of the frame',
  large:    'full detailed chibi body from head to toe, centered, character fills most of the frame',
}

function buildPrompt(moods: string[], subject: string, size: string): string {
  const moodDesc = moods.map(m => MOOD_PROMPTS[m] ?? m).join(', ')
  const subjectDesc = SUBJECT_PROMPTS[subject] ?? subject
  const framing = FRAMING_BY_SIZE[size] ?? FRAMING_BY_SIZE.square
  return `${moodDesc} ${subjectDesc}. ${framing}. Huge expressive eyes, bold clearly visible smile.`
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
  if (!origin) return true
  const allowed = process.env.ALLOWED_ORIGIN
  if (!allowed) return true
  return origin === allowed || /^https?:\/\/localhost(:\d+)?$/.test(origin)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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

  const { width, height } = SIZE_MAP[size]
  const prompt = buildPrompt(mood as string[], subject, size)

  try {
    const replicateRes = await fetch(
      'https://api.replicate.com/v1/models/retro-diffusion/rd-plus/predictions',
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
            style: 'default',
            width,
            height,
            num_images: 1,
            bypass_prompt_expansion: true,
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
    const mimeType = contentType.split(';')[0]

    res.setHeader('X-Rate-Limit-Remaining', remaining.toString())
    return res.status(200).json({ imageBase64: `data:${mimeType};base64,${base64}` })
  } catch (e) {
    console.error('generate error', e)
    return res.status(500).json({ error: 'generation_failed' })
  }
}
