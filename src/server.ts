import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

// Edge HTML cache via the Cloudflare Cache API.
//
// Why this exists: the free Workers plan caps CPU at 10 ms per request, and
// SSR pages that render catalog data blow past it under traffic bursts
// (exceededResources hit ~27% of requests on 2026-11-17/18). Setting a
// Cache-Control header alone does NOT make the edge cache Worker responses
// (verified live 2026-11-18: no cf-cache-status header, every request
// reached the Worker), so cacheable pages are stored in caches.default here
// and replayed before any rendering happens.
//
// Only anonymous, fully static pages are cached (whitelist in edgeCacheKey).
// They change only at the daily catalog sync (~04:14) and at deploys, so a
// 1-hour TTL bounds staleness while absorbing nearly all repeat traffic.
// Never cached: the wishlist (page and API), /random, server functions, and
// anything carrying a query string outside the rankings `board` whitelist —
// those always render fresh.

const EDGE_CACHE_TTL_SECONDS = 3600
const LOCALES = new Set(['zh-CN', 'en', 'ja'])
const RANKING_BOARDS = new Set(['popular', 'rising', 'latest'])

function edgeCacheKey(request: Request): string | null {
  if (request.method !== 'GET') return null

  const url = new URL(request.url)
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length === 0 || !LOCALES.has(segments[0])) return null

  const paramKeys = [...url.searchParams.keys()]

  // /{locale} — homepage (template previews carry a query: not cached)
  if (segments.length === 1) {
    return paramKeys.length === 0 ? url.href : null
  }

  // /{locale}/games/{slug} and /{locale}/games/{slug}/play
  if (
    segments[1] === 'games' &&
    (segments.length === 3 ||
      (segments.length === 4 && segments[3] === 'play'))
  ) {
    return paramKeys.length === 0 ? url.href : null
  }

  // /{locale}/platform/{collectionId}
  if (segments[1] === 'platform' && segments.length === 3) {
    return paramKeys.length === 0 ? url.href : null
  }

  // /{locale}/rankings?board=popular|rising|latest
  if (segments[1] === 'rankings' && segments.length === 2) {
    const board = url.searchParams.get('board')
    if (paramKeys.length === 1 && board && RANKING_BOARDS.has(board)) {
      return `${url.origin}${url.pathname}?board=${board}`
    }
    return null
  }

  return null
}

const appFetch = createStartHandler(defaultStreamHandler)

type WorkerFetch = (
  request: Request,
  env: unknown,
  ctx: { waitUntil: (promise: Promise<unknown>) => void },
) => Promise<Response>

const fetchWithEdgeCache: WorkerFetch = async (request, env, ctx) => {
  const key = edgeCacheKey(request)
  if (!key || typeof caches === 'undefined') {
    return (appFetch as WorkerFetch)(request, env, ctx)
  }

  const cache = caches.default
  const cacheKey = new Request(key, { method: 'GET' })

  const hit = await cache.match(cacheKey)
  if (hit) {
    const response = new Response(hit.body, hit)
    // The stored copy carries max-age=TTL for cache expiry; browsers must
    // still revalidate on every load.
    response.headers.set(
      'Cache-Control',
      `public, max-age=0, s-maxage=${EDGE_CACHE_TTL_SECONDS}`,
    )
    response.headers.set('X-Edge-Cache', 'HIT')
    return response
  }

  const response = await (appFetch as WorkerFetch)(request, env, ctx)
  const cacheable =
    response.status === 200 &&
    (response.headers.get('content-type') ?? '').includes('text/html') &&
    !response.headers.has('set-cookie') &&
    response.body !== null
  if (!cacheable) return response

  // Tee the streamed SSR body: one branch goes to the visitor now, the
  // other is stored in the edge cache in the background.
  const [clientBody, cacheBody] = response.body!.tee()
  const storedHeaders = new Headers(response.headers)
  storedHeaders.delete('set-cookie')
  storedHeaders.set(
    'Cache-Control',
    `public, max-age=${EDGE_CACHE_TTL_SECONDS}, s-maxage=${EDGE_CACHE_TTL_SECONDS}`,
  )
  ctx.waitUntil(
    cache.put(
      cacheKey,
      new Response(cacheBody, {
        status: response.status,
        headers: storedHeaders,
      }),
    ),
  )

  const clientHeaders = new Headers(response.headers)
  clientHeaders.set('X-Edge-Cache', 'MISS')
  return new Response(clientBody, {
    status: response.status,
    headers: clientHeaders,
  })
}

export default { fetch: fetchWithEdgeCache }
