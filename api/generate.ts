import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { perlerColors } from './palette.js'

// --- Closed vocabularies ---
const VALID_MOODS = new Set(['søt', 'morsom', 'skummel', 'kul', 'magisk', 'snill'])
const VALID_SUBJECTS = new Set(['dyr', 'monster', 'mat', 'natur', 'robot'])
const SIZE_MAP: Record<string, { rows: number; cols: number }> = {
  small:    { rows: 11, cols: 11 },
  portrait: { rows: 21, cols: 13 },
  square:   { rows: 19, cols: 19 },
  large:    { rows: 29, cols: 29 },
}

// --- Simple in-memory rate limiter (resets on cold start; good enough for edge) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const MAX_PER_DAY = parseInt(process.env.RATE_LIMIT_PER_DAY ?? '10', 10)
const DAILY_COST_CAP = parseFloat(process.env.DAILY_COST_CAP ?? '5')
let todayCost = 0
let costResetDate = new Date().toDateString()

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


function buildSystemPrompt(rows: number, cols: number): string {
  const total = rows * cols
  const small = Math.min(rows, cols) <= 11
  const maxColors = small ? '4-5' : Math.min(rows, cols) <= 19 ? '5-7' : '7-10'
  const margin = small ? 1 : 2
  const innerR = rows - 2 * margin
  const innerC = cols - 2 * margin

  return `You are a pixel-art designer making ${rows}×${cols} Perler bead patterns (${rows} rows, ${cols} cols) for children aged 7–10. Target style: classic 8-bit game sprites — bold outlines, flat fills, instantly recognisable silhouettes.

Output ONLY valid JSON — no prose, no markdown fences:
{
  "thinking": "<2-3 sentence plan: view chosen, key shapes, colour layout>",
  "title": "<short Norwegian title, max 30 chars>",
  "palette": [{"idx": 0, "name": "<Perler name>", "code": "<Perler code>", "hex": "#RRGGBB"}, ...],
  "grid": "<${rows} lines of exactly ${cols} chars each, palette index A-Z, newline-separated>"
}

NON-NEGOTIABLE RULES:
1. FILL THE GRID — subject must fill the inner ${innerR}×${innerC} area (inside the ${margin}-cell background border). A tiny subject floating in empty space is wrong.
2. ICONIC VIEW — pick the most recognisable angle: animals/monsters/faces → front-facing; vehicles → side profile; food → front-facing.
3. OUTLINE — 1-pixel dark outline traces the entire subject silhouette.
4. SYMMETRY — design must be left-right symmetric (col 0 mirrors col ${cols - 1}, etc.) unless it is a side-profile view. Verify symmetry row by row before outputting.
5. FLAT FILLS — large solid colour regions, no dithering, no gradients, no isolated single pixels.
6. COLOUR COUNT — ${maxColors} colours max including background. Fewer = cleaner.
7. KEY FEATURES ONLY — 2-3 defining features per subject:
   • animal/monster face → ears or horns, large eyes, nose
   • food → clear layers or iconic outline (burger stack, pizza triangle)
   • vehicle → wheels, windows, body silhouette
   • robot → square head, antenna, dot eyes
   • nature → bold shape, 2-colour fill (stem + bloom)

GRID RULES:
- A = background (all empty space + the ${margin}-cell border)
- B, C, D… = subject colours in palette order
- EXACTLY ${rows} rows × EXACTLY ${cols} chars per row = ${total} cells total
- Count every row before writing — wrong length rows break everything

VERIFIED EXAMPLE — 11×11 søt kattepus (front-facing cat face):
{"thinking":"Front-facing cat face. Orange oval head with two pointed ears. Symmetric black dot eyes at row 4. Pink nose at centre row 6. Black mouth corners at row 7. Fills inner 9×9.",
"title":"Kattepus","palette":[{"idx":0,"name":"Hvit","code":"80001","hex":"#FFFFFF"},{"idx":1,"name":"Oransje","code":"80009","hex":"#FF8C00"},{"idx":2,"name":"Svart","code":"80057","hex":"#111111"},{"idx":3,"name":"Rosa","code":"80023","hex":"#FF69B4"}],
"grid":"AAAAAAAAAAA\\nABBAAAAABBA\\nABBBAAABBBA\\nABBBBBBBBBA\\nABCBBBBBCBA\\nABBBBBBBBBA\\nABBBBDBBBBA\\nABBCBBBCBBA\\nAABBBBBBBAA\\nAAABBBBBAAA\\nAAAAAAAAAAA"}

Notice: 1-cell white border, ears at rows 1-2, symmetric black eyes (col 2 and col 8), pink nose at col 5 (centre), black mouth corners, large orange fill. Child-friendly always, even for "skummel".`
}

function extractJson(text: string): string {
  const start = text.indexOf('{')
  if (start === -1) throw new Error('no JSON in response')
  let depth = 0, inString = false, escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (!inString) {
      if (ch === '{') depth++
      else if (ch === '}' && --depth === 0) return text.slice(start, i + 1)
    }
  }
  throw new Error('unbalanced JSON in response')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Input validation ---
  const { mood, subject, size = 'medium', bust } = req.body ?? {}

  if (!Array.isArray(mood) || mood.length === 0 || typeof subject !== 'string') {
    return res.status(400).json({ error: 'Invalid input' })
  }

  const invalidMood = mood.find((m: unknown) => typeof m !== 'string' || !VALID_MOODS.has(m))
  if (invalidMood !== undefined) return res.status(400).json({ error: 'Invalid mood tag' })
  if (!VALID_SUBJECTS.has(subject)) return res.status(400).json({ error: 'Invalid subject tag' })
  if (typeof size !== 'string' || !SIZE_MAP[size]) return res.status(400).json({ error: 'Invalid size' })
  const { rows: gridRows, cols: gridCols } = SIZE_MAP[size]

  // --- Rate limit ---
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? '0.0.0.0'
  const { allowed, remaining } = checkRateLimit(ip)
  if (!allowed) {
    return res.status(429).json({ error: 'rate_limit', remaining: 0 })
  }

  // --- Daily cost cap ---
  const today = new Date().toDateString()
  if (today !== costResetDate) { todayCost = 0; costResetDate = today }
  if (todayCost >= DAILY_COST_CAP) {
    return res.status(503).json({ error: 'daily_cap' })
  }

  // --- Build prompt ---
  const systemPrompt = buildSystemPrompt(gridRows, gridCols)
  const userMessage = `Mood tags: ${(mood as string[]).join(', ')}
Subject: ${subject}

Available Perler palette:
${JSON.stringify(perlerColors)}

Generate the pattern.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Attempt with optional retry
  const attempt = async (): Promise<object> => {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: userMessage }],
      // Enable prompt caching on system prompt (stable) unless bust=true
      ...(bust ? { system: systemPrompt } : {
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] as Parameters<typeof client.messages.create>[0]['system'],
      }),
    })

    const raw = response.content.find(b => b.type === 'text')?.text ?? ''
    const parsed = JSON.parse(extractJson(raw))

    // Validate structure
    if (!parsed.palette || !Array.isArray(parsed.palette)) throw new Error('bad palette')
    if (typeof parsed.grid !== 'string') throw new Error('bad grid')
    let gridRows2 = parsed.grid.split('\n').filter((r: string) => r.length > 0)
    while (gridRows2.length < gridRows) gridRows2.push('A'.repeat(gridCols))
    gridRows2 = gridRows2.slice(0, gridRows)
    gridRows2 = gridRows2.map((r: string) => {
      if (r.length === gridCols) return r
      if (r.length > gridCols) return r.slice(0, gridCols)
      return r + 'A'.repeat(gridCols - r.length)
    })
    parsed.grid = gridRows2.join('\n')

    // Estimate cost ($0.003/$0.015 per 1k tokens for Sonnet 4.6)
    const inputTokens = response.usage?.input_tokens ?? 3000
    const outputTokens = response.usage?.output_tokens ?? 1500
    todayCost += (inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.015

    return parsed
  }

  try {
    let result: object
    try {
      result = await attempt()
    } catch {
      // One retry
      result = await attempt()
    }
    res.setHeader('X-Rate-Limit-Remaining', remaining.toString())
    return res.status(200).json(result)
  } catch (e) {
    console.error('generate error', e)
    return res.status(500).json({ error: 'generation_failed' })
  }
}
