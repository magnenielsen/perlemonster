import Anthropic from '@anthropic-ai/sdk'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { perlerColors } from './palette.js'

// --- Closed vocabularies ---
const VALID_MOODS = new Set(['søt', 'morsom', 'skummel', 'kul', 'magisk', 'snill'])
const VALID_SUBJECTS = new Set(['dyr', 'monster', 'mat', 'romvesen', 'eventyr', 'kjøretøy', 'natur', 'robot'])
const SIZE_MAP: Record<string, number> = { small: 11, medium: 19, large: 29 }

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


function buildSystemPrompt(n: number): string {
  const total = n * n
  const colors = n <= 11 ? '4-8' : n <= 19 ? '6-12' : '8-15'
  return `You are a pixel-art designer creating ${n}×${n} bead patterns for a 7–10 year old child's Perler bead project.

You must output ONLY valid JSON matching this exact schema:
{
  "title": "<short Norwegian title, max 30 chars>",
  "palette": [{"idx": 0, "name": "<Perler name>", "code": "<Perler code>", "hex": "#RRGGBB"}, ...],
  "grid": "<${n} lines, ${n} single-character palette indices per line, A-Z, separated by newlines>"
}

Rules:
- The grid is EXACTLY ${n} rows of EXACTLY ${n} characters each, total ${total} cells
- Each character is a palette index, A through whatever (max 26 colours: A-Z)
- Use ${colors} colours from the supplied Perler palette
- Index A is the background colour (usually white or a sky tone)
- Centre the subject; leave 1-2 cells of margin on all sides
- Use bold, clear shapes with strong outlines; avoid single-pixel details
- Child-friendly: cute, never gory or disturbing, even with "skummel" tags
- Output JSON only, no commentary, no markdown fences`
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
  const gridSize = SIZE_MAP[size]

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
  const systemPrompt = buildSystemPrompt(gridSize)
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
      max_tokens: 3000,
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
    let rows = parsed.grid.split('\n').filter((r: string) => r.length > 0)
    // Pad or trim row count to exact gridSize
    while (rows.length < gridSize) rows.push('A'.repeat(gridSize))
    rows = rows.slice(0, gridSize)
    // Pad or trim each row to exact size
    rows = rows.map((r: string) => {
      if (r.length === gridSize) return r
      if (r.length > gridSize) return r.slice(0, gridSize)
      return r + 'A'.repeat(gridSize - r.length)
    })
    parsed.grid = rows.join('\n')

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
