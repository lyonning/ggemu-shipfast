import { createServerFn } from '@tanstack/react-start'
import { env as cloudflareEnv } from 'cloudflare:workers'

// Game wishlist ("游戏愿望单"): visitors ask for games they want added.
// Wishes live as one JSON document in the R2 bucket bound as DATA_BUCKET
// (bucket retroplay-data, key wishlist.json). Read-modify-write is fine
// at this volume; the list is capped so the document stays small.

export type Wish = {
  id: string
  name: string
  platform: string
  category: string
  era: string
  createdAt: string
}

const WISHLIST_KEY = 'wishlist.json'
const MAX_STORED_WISHES = 500
const LIST_LIMIT = 100

function dataBucket() {
  const bucket = cloudflareEnv.DATA_BUCKET
  return bucket && typeof bucket.get === 'function' ? bucket : null
}

async function readWishes(): Promise<Array<Wish>> {
  const bucket = dataBucket()
  if (!bucket) return []

  try {
    const object = await bucket.get(WISHLIST_KEY)
    if (!object) return []
    const parsed = JSON.parse(await object.text())
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (wish): wish is Wish =>
        Boolean(wish) &&
        typeof wish === 'object' &&
        typeof (wish as Wish).id === 'string' &&
        typeof (wish as Wish).name === 'string' &&
        typeof (wish as Wish).createdAt === 'string',
    )
  } catch {
    return []
  }
}

export const getWishes = createServerFn({ method: 'GET' }).handler(
  async () => {
    const wishes = await readWishes()

    return {
      available: Boolean(dataBucket()),
      total: wishes.length,
      wishes: wishes.slice(0, LIST_LIMIT),
    }
  },
)

function cleanField(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export const addWish = createServerFn({ method: 'POST' })
  .validator(
    (payload: {
      name?: string
      platform?: string
      category?: string
      era?: string
      // Honeypot: real users never fill this hidden field.
      website?: string
    }) => ({
      category: cleanField(payload.category, 40),
      era: cleanField(payload.era, 20),
      name: cleanField(payload.name, 60),
      platform: cleanField(payload.platform, 40),
      website: cleanField(payload.website, 10),
    }),
  )
  .handler(async ({ data }) => {
    if (data.website) {
      // Bot submission via the honeypot; pretend success, store nothing.
      return { ok: true as const }
    }

    if (!data.name) {
      return { ok: false as const, reason: 'name-required' }
    }

    const bucket = dataBucket()
    if (!bucket) {
      return { ok: false as const, reason: 'unavailable' }
    }

    const wish: Wish = {
      category: data.category,
      createdAt: new Date().toISOString(),
      era: data.era,
      id: crypto.randomUUID(),
      name: data.name,
      platform: data.platform,
    }

    try {
      const wishes = await readWishes()
      await bucket.put(
        WISHLIST_KEY,
        JSON.stringify([wish, ...wishes].slice(0, MAX_STORED_WISHES)),
      )
    } catch {
      return { ok: false as const, reason: 'unavailable' }
    }

    return { ok: true as const, wish }
  })
