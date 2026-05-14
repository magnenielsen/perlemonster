import type { VercelRequest, VercelResponse } from '@vercel/node'

const VALID_MOODS = new Set(['søt', 'morsom', 'skummel', 'kul'])
const VALID_SUBJECTS = new Set(['dyr', 'monster', 'mat', 'natur', 'robot'])

const SIZE_MAP: Record<string, { rows: number; cols: number; aspect: string }> = {
  portrait: { rows: 21, cols: 13, aspect: '2:3' },
  square:   { rows: 19, cols: 19, aspect: '1:1' },
  large:    { rows: 29, cols: 29, aspect: '1:1' },
}

const SUBJECT_PROMPTS: Record<string, string> = {
  dyr:     'cute animal face',
  monster: 'cute cartoon monster face',
  mat:     'food item',
  natur:   'nature element like a flower or leaf',
  robot:   'cute robot',
}

const MOOD_PROMPTS: Record<string, string> = {
  søt:     'cute and sweet',
  morsom:  'funny and silly',
  skummel: 'spooky and scary',
  kul:     'cool',
}

const COMPLEXITY_BY_SIZE: Record<string, string> = {
  portrait: 'Simple character shape, 3 or 4 flat color regions, bold chunky body proportions.',
  square:   'Simple sprite, 4 or 5 flat color regions, chunky bold shapes.',
  large:    'Clear detailed sprite, 5 or 6 flat color regions, instantly recognizable silhouette.',
}

function buildFluxPrompt(moods: string[], subject: string, size: string): string {
  const moodDesc = moods.map(m => MOOD_PROMPTS[m] ?? m).join(', ')
  const subjectDesc = SUBJECT_PROMPTS[subject] ?? subject
  const complexity = COMPLEXITY_BY_SIZE[size] ?? COMPLEXITY_BY_SIZE.small
  return (
    `${moodDesc} ${subjectDesc}, pixel art bead pattern sprite. ` +
    `Solid medium gray background fills the entire image. Subject centered with a small gray border. ` +
    `${complexity} ` +
    `Bold black outline around subject. Flat solid colors only. ` +
    `No shading, no gradients, no anti-aliasing, no thin lines, no textures. ` +
    `Classic 8-bit NES game sprite style.`
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { mood, subject, size = 'square' } = req.body ?? {}

  if (!Array.isArray(mood) || mood.length === 0 || typeof subject !== 'string') {
    return res.status(400).json({ error: 'Invalid input' })
  }
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

    const imgRes = await fetch(prediction.output[0])
    const imgBuffer = await imgRes.arrayBuffer()
    const base64 = Buffer.from(imgBuffer).toString('base64')

    res.setHeader('X-Rate-Limit-Remaining', remaining.toString())
    return res.status(200).json({ imageBase64: `data:image/png;base64,${base64}` })
  } catch (e) {
    console.error('generate error', e)
    return res.status(500).json({ error: 'generation_failed' })
  }
}
