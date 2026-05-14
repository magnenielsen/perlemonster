export interface GenerateRequest {
  mood: string[]
  subject: string
  size?: 'small' | 'portrait' | 'square' | 'large'
  bust?: boolean
}

export async function generatePattern(req: GenerateRequest): Promise<{ imageBase64: string }> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}))
    throw new RateLimitError(data.remaining ?? 0)
  }

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = await res.json()
  if (!data.imageBase64) throw new Error('no image in response')
  return { imageBase64: data.imageBase64 as string }
}

export class RateLimitError extends Error {
  remaining: number
  constructor(remaining: number) {
    super('rate_limit')
    this.remaining = remaining
  }
}
