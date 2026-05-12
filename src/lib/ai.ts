import { parseClaudeResponse } from './grid'
import type { ParsedPattern } from './grid'

export interface GenerateRequest {
  mood: string[]
  subject: string
  bust?: boolean // true = skip cache (Gi meg en ny)
}

export async function generatePattern(req: GenerateRequest): Promise<ParsedPattern> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}))
    throw new RateLimitError(data.remaining ?? 0)
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const data = await res.json()

  // data has { palette, grid, title } in Claude's schema
  return parseClaudeResponse(JSON.stringify(data))
}

export class RateLimitError extends Error {
  remaining: number
  constructor(remaining: number) {
    super('rate_limit')
    this.remaining = remaining
  }
}
