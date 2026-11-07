import { createServerFn } from '@tanstack/react-start'
import { PRODUCTION_SITE_ORIGIN } from './seo'
import { hasApprovedGames, isApprovedGame, isApprovedGameId } from './game-policy'
import catalogSnapshot from '../../config/catalog-snapshot.json'
import fcCartridges from '../../config/fc-cartridges.json'
import localRoms from '../../config/local-roms.json'
import rankingsData from '../../config/rankings-data.json'
import { getCollectionDef } from './collections'

const API_BASE_URL = 'https://ggemu.com'

// Local catalog snapshot (config/catalog-snapshot.json, refreshed daily by
// scripts/snapshot-catalog.mjs). It is the fallback when the GGEMU API is
// unreachable, and it records which covers are mirrored on our own assets
// host so pages can serve those instead of GGEMU's storage.
type SnapshotGame = PublicGame & { _approved_id?: string; local_cover?: boolean }

const LOCAL_COVER_BASE = 'https://assets.1231533.com/covers'
const snapshotGames = catalogSnapshot as Array<SnapshotGame>
const snapshotByApprovedId = new Map<string, SnapshotGame>()
for (const game of snapshotGames) {
  if (game._approved_id) snapshotByApprovedId.set(game._approved_id, game)
  if (game.url_slug) snapshotByApprovedId.set(game.url_slug, game)
  if (game._id) snapshotByApprovedId.set(game._id, game)
}

function stripSnapshotFields(game: SnapshotGame): PublicGame {
  const { _approved_id, local_cover, ...rest } = game
  return rest
}

function withLocalCover<T extends PublicGame>(game: T): T {
  if (!game._id) return game
  const snapshot = snapshotByApprovedId.get(game._id)
    ?? (game.url_slug ? snapshotByApprovedId.get(game.url_slug) : undefined)
  if (snapshot?.local_cover) {
    return { ...game, game_cover: `${LOCAL_COVER_BASE}/${game._id}.jpg` }
  }
  return game
}

function getSnapshotCatalog(): Array<PublicGame> {
  return dedupeGames(snapshotGames.map((game) => withLocalCover(stripSnapshotFields(game))))
}

function getSnapshotGame(id: string): PublicGame | null {
  const snapshot = snapshotByApprovedId.get(id)
  return snapshot ? withLocalCover(stripSnapshotFields(snapshot)) : null
}

// Phase 2 local ROMs (config/local-roms.json, produced by the migration
// scripts): games whose ROM file is mirrored in our own R2 bucket and can
// be played with the self-hosted EmulatorJS player instead of the GGEMU
// iframe. The registry is keyed by approved game id.
const LOCAL_ROM_BASE = 'https://roms.1231533.com'
const localRomByApprovedId = localRoms as Record<string, { id: string; ext: string; file?: string }>

// EmulatorJS core per platform (names follow EmulatorJS 4.2).
const CORE_BY_PLATFORM: Record<string, string> = {
  'Famicom': 'nes',
  'Super Famicom': 'snes',
  'Game Boy': 'gb',
  'Game Boy Color': 'gb',
  'Game Boy Advance': 'gba',
  'Genesis': 'segaMD',
  'Master System': 'segaMS',
  'Game Gear': 'segaGG',
  'Sega CD': 'segaCD',
  'Nintendo 64': 'n64',
  'Nintendo DS': 'nds',
  'Arcade': 'arcade',
  'PC Engine': 'pce',
}

function withLocalRom(game: PublicGame, approvedId: string): PublicGame {
  const entry = localRomByApprovedId[approvedId]
    ?? (game.url_slug ? localRomByApprovedId[game.url_slug] : undefined)
    ?? (game._id ? localRomByApprovedId[game._id] : undefined)
  const core = game.platform ? CORE_BY_PLATFORM[game.platform] : undefined
  if (!entry || !core) return game
  // Arcade entries carry an explicit file name: FBNeo identifies the
  // romset by the ZIP's file name (e.g. kof97.zip), so those ROMs are
  // served under their romset name instead of game.zip.
  const fileName = entry.file ?? `game.${entry.ext}`
  return {
    ...game,
    local_rom: { url: `${LOCAL_ROM_BASE}/${entry.id}/${fileName}`, core },
  }
}
const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const NON_GCOIN_GAME = '0'

export type Locale = 'zh-CN' | 'en' | 'ja'
export type GameSearchSort =
  | 'newest'
  | 'popular'
  | 'oldest'
  | 'name_asc'
  | 'likes'
  | 'plays_count'
  | 'views'
  | 'likes_count'
  | 'views_count'

export type PublicGame = {
  _id?: string
  url_slug?: string
  name?: string
  description?: string
  how_to_play?: string
  developer?: string
  released_year?: string
  keywords?: string
  platform?: string
  platform_slug?: string
  platformSlug?: string
  categories?: Array<string>
  languages?: Array<string>
  players?: number
  play_online?: number
  play_device?: number
  downloadable?: number
  is_gcoin_game?: number
  game_cover?: string
  game_video?: string
  local_rom?: { url: string; core: string }
  likes_count?: number
  comments_count?: number
  views_count?: number
  plays_count?: number
}

export type Pagination = {
  total: number
  page: number
  limit: number
  pages: number
}

export type GameSearchResult = {
  games: Array<PublicGame>
  pagination: Pagination
}

export type PublicLiveRoom = {
  roomId: string
  game: {
    _id: string
    slug: string
    url_slug: string
    name: string
    game_cover: string
    platform: string
  }
}

export type LiveRoomSearchResult = {
  rooms: Array<PublicLiveRoom>
  pagination: Pagination
}

export type FilterOption = {
  name: string
  slug?: string
  href?: string
  count?: number
}

export type GameFilterOptions = {
  platforms: Array<FilterOption>
  categories: Array<FilterOption>
}

export type GameDetailPageData = {
  canonicalUrl: string
  game: PublicGame
}

export type RelatedGamesData = {
  relatedByCategory: Array<PublicGame>
  relatedByDeveloper: Array<PublicGame>
}

export type BlogPost = {
  _id?: string
  title?: string
  slug?: string
  href?: string
  cover_image_url?: string
  comments_count?: number
  excerpt?: string
  content?: string
  created_at?: string
  updated_at?: string
}

export type BlogPostSearchResult = {
  blogPosts: Array<BlogPost>
  pagination: Pagination
}

export type BlogPostDetailPageData = {
  blogPost: BlogPost
  canonicalUrl: string
}

type GameSearchPayload = {
  query?: string
  locale?: Locale
  page?: number
  limit?: number
  platform?: string
  category?: string
  sort?: GameSearchSort
}

type GameDetailPayload = {
  id: string
  locale?: Locale
}

type LiveRoomSearchPayload = {
  page?: number
  limit?: number
}

type RandomGamePayload = {
  platform?: string
}

type RelatedGamesPayload = {
  category?: string
  currentId: string
  developer?: string
}

type BlogPostSearchPayload = {
  keyword?: string
  page?: number
  limit?: number
  includeContent?: boolean
}

type BlogPostDetailPayload = {
  id: string
  locale?: Locale
}

type FilterOptionResponse = {
  success: true
  data: Array<FilterOption>
}

type GameDetailResponse = {
  success: true
  data: PublicGame
}

type GameSearchResponse = {
  success: true
  data: Array<PublicGame>
  pagination: Pagination
}

type LiveRoomSearchResponse = {
  success: true
  count: number
  items: Array<PublicLiveRoom>
  pagination: Pagination
}

type RandomGame = Pick<PublicGame, '_id' | 'url_slug'>

type BlogPostSearchResponse = {
  success: true
  blogPosts: Array<BlogPost>
  pagination: Pagination
}

type BlogPostDetailResponse = {
  success: true
  blogPost: BlogPost
}

function normalizePage(page: unknown) {
  const parsed = Number(page)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function normalizeLimit(limit: unknown) {
  const parsed = Number(limit)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return PAGE_SIZE
  }

  return Math.min(parsed, MAX_PAGE_SIZE)
}

function normalizeLocale(locale: unknown): Locale {
  return locale === 'en' || locale === 'ja' ? locale : 'zh-CN'
}

function normalizeSort(sort: unknown): GameSearchSort {
  if (
    sort === 'popular' ||
    sort === 'oldest' ||
    sort === 'name_asc' ||
    sort === 'likes' ||
    sort === 'plays_count' ||
    sort === 'views' ||
    sort === 'likes_count' ||
    sort === 'views_count'
  ) {
    return sort
  }

  return 'newest'
}

function addOptionalParam(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  const trimmed = value?.trim()

  if (trimmed) {
    params.set(key, trimmed)
  }
}

async function fetchJson<T>(path: string, params: URLSearchParams) {
  const query = params.toString()
  const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`)

  if (!response.ok) {
    throw new Error(`GGEMU API request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

const APPROVED_CATALOG_TTL_MS = 60_000
const APPROVED_CATALOG_PAGE_SIZE = 100
let approvedCatalogCache: { expiresAt: number; games: Array<PublicGame> } | null = null

async function fetchApprovedCatalogPage(page: number) {
  const params = new URLSearchParams({
    is_gcoin_game: NON_GCOIN_GAME,
    limit: String(APPROVED_CATALOG_PAGE_SIZE),
    page: String(page),
    play_online: '1',
    sort: 'newest',
  })

  // Retry transient upstream failures so one flaky page cannot drop games.
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchJson<GameSearchResponse>('/api/games/search', params)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

let approvedCatalogBuild: Promise<Array<PublicGame>> | null = null

async function getApprovedCatalog() {
  if (!hasApprovedGames()) return []
  if (approvedCatalogCache && approvedCatalogCache.expiresAt > Date.now()) {
    return approvedCatalogCache.games
  }

  // Share one in-flight build between concurrent callers (e.g. a detail page
  // loading several game lists at once), so their subrequests never stack up
  // into parallel catalog builds.
  if (!approvedCatalogBuild) {
    approvedCatalogBuild = buildApprovedCatalog().finally(() => {
      approvedCatalogBuild = null
    })
  }

  try {
    return await approvedCatalogBuild
  } catch (error) {
    // Serve the last good catalog rather than failing the page outright.
    if (approvedCatalogCache) return approvedCatalogCache.games
    // No live build and no cache (e.g. upstream down after a restart):
    // fall back to the local snapshot so the catalog keeps working.
    if (snapshotGames.length > 0) return getSnapshotCatalog()
    throw error
  }
}

async function buildApprovedCatalog() {
  // Page through the upstream search API instead of fetching every game's
  // detail: a full build takes ~18 subrequests, while one detail fetch per
  // approved game exceeds the Worker's subrequest limit and silently
  // truncates the catalog to the first few dozen games.
  const games: Array<PublicGame> = []
  let page = 1
  let pageCount = 1
  while (page <= pageCount) {
    const result = await fetchApprovedCatalogPage(page)
    games.push(...result.data.filter((game) => isApprovedGame(game)))
    pageCount = result.pagination.pages
    page += 1
  }

  approvedCatalogCache = {
    expiresAt: Date.now() + APPROVED_CATALOG_TTL_MS,
    games: dedupeGames(games).map((game) => withLocalCover(game)),
  }
  return approvedCatalogCache.games
}

async function fetchGames(params: URLSearchParams) {
  const page = normalizePage(params.get('page'))
  const limit = normalizeLimit(params.get('limit'))
  const query = (params.get('query') ?? '').trim().toLowerCase()
  const platform = (params.get('platform') ?? '').trim().toLowerCase()
  const category = (params.get('category') ?? '').trim().toLowerCase()
  const sort = params.get('sort') ?? 'newest'

  const games = (await getApprovedCatalog()).filter((game) => {
    if (game.play_online === 0 || game.is_gcoin_game === 1) return false
    if (query && ![game.name, game.description, game.keywords, game.developer].some(
      (value) => value?.toLowerCase().includes(query),
    )) return false
    if (platform && ![game.platform, game.platform_slug, game.platformSlug].some(
      (value) => value?.toLowerCase() === platform,
    )) return false
    if (category && !game.categories?.some((value) => value.toLowerCase() === category)) return false
    return true
  })
  const getNumber = (game: PublicGame, key: 'plays_count' | 'views_count' | 'likes_count') => game[key] ?? 0
  games.sort((a, b) => {
    if (sort === 'name_asc') return (a.name ?? '').localeCompare(b.name ?? '')
    if (sort === 'popular' || sort === 'plays_count') return getNumber(b, 'plays_count') - getNumber(a, 'plays_count')
    if (sort === 'views' || sort === 'views_count') return getNumber(b, 'views_count') - getNumber(a, 'views_count')
    if (sort === 'likes' || sort === 'likes_count') return getNumber(b, 'likes_count') - getNumber(a, 'likes_count')
    return 0
  })
  if (sort === 'oldest') games.reverse()
  const total = games.length
  return {
    games: games.slice((page - 1) * limit, page * limit),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  } satisfies GameSearchResult
}

function getGameId(game: PublicGame) {
  return game.url_slug?.trim() || game._id?.trim() || ''
}

function getAbsoluteGameUrl(origin: string, locale: Locale, game: PublicGame, fallbackId: string) {
  const id = encodeURIComponent(getGameId(game) || fallbackId)

  return `${origin}/${locale}/games/${id}`
}

function getBlogPostId(blogPost: BlogPost) {
  return blogPost.slug?.trim() || blogPost._id?.trim() || ''
}

function getAbsoluteBlogPostUrl(
  origin: string,
  locale: Locale,
  blogPost: BlogPost,
  fallbackId: string,
) {
  const id = encodeURIComponent(getBlogPostId(blogPost) || fallbackId)

  return `${origin}/${locale}/blog/${id}`
}

function isSameGame(game: PublicGame, id: string) {
  return getGameId(game) === id
}

function dedupeGames(games: Array<PublicGame>) {
  const seen = new Set<string>()

  return games.filter((game) => {
    const id = getGameId(game)

    if (!id || seen.has(id)) {
      return false
    }

    seen.add(id)
    return true
  })
}

function normalizeFilterOptions(options: Array<FilterOption>) {
  const seen = new Set<string>()

  return options.filter((option) => {
    const name = option.name?.trim()

    if (!name || seen.has(name)) {
      return false
    }

    seen.add(name)
    return true
  })
}

function normalizePlatformKey(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function getHrefLastSegment(href: string | undefined) {
  const cleaned = href?.trim().split(/[?#]/)[0]?.replace(/\/+$/, '')

  return cleaned?.split('/').pop()
}

function resolvePlatformName(value: string, platforms: Array<FilterOption>) {
  const key = normalizePlatformKey(value)
  const matched = platforms.find((platform) => {
    return [
      platform.name,
      platform.slug,
      getHrefLastSegment(platform.href),
    ].some((candidate) => normalizePlatformKey(candidate) === key)
  })

  return matched?.name?.trim() || value
}

function parseRandomPlatforms(value: string | undefined, platforms: Array<FilterOption>) {
  const seen = new Set<string>()
  const resolved = value
    ?.split(',')
    .map((platform) => platform.trim())
    .filter(Boolean)
    .map((platform) => resolvePlatformName(platform, platforms)) ?? []

  return resolved.filter((platform) => {
    const key = normalizePlatformKey(platform)

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function pickRandomItem<T>(items: Array<T>) {
  return items[Math.floor(Math.random() * items.length)]
}

function pickRandomPlatform(value: string | undefined, platforms: Array<FilterOption>) {
  const resolvedPlatforms = parseRandomPlatforms(value, platforms)

  return resolvedPlatforms.length > 0 ? pickRandomItem(resolvedPlatforms) : undefined
}

function isOnlinePlayableGame(game: PublicGame) {
  return game.play_online === 1 && (game.play_device === 0 || game.play_device === 2)
}

function toRandomGame(game: PublicGame): RandomGame {
  return {
    _id: game._id,
    url_slug: game.url_slug,
  }
}

async function fetchRandomPlayableGame(platform: string | undefined) {
  const games = (await getApprovedCatalog()).filter(
    (game) => isOnlinePlayableGame(game)
      && game.is_gcoin_game !== 1
      && (!platform || normalizePlatformKey(game.platform) === normalizePlatformKey(platform)),
  )
  return games.length > 0 ? toRandomGame(pickRandomItem(games)) : null
}

async function fetchRelatedGames({
  category,
  currentId,
  developer,
}: {
  category?: string
  currentId: string
  developer?: string
}) {
  const categoryParams = new URLSearchParams({
    is_gcoin_game: NON_GCOIN_GAME,
    limit: '8',
    page: '1',
    play_online: '1',
    sort: 'popular',
  })
  const developerParams = new URLSearchParams({
    is_gcoin_game: NON_GCOIN_GAME,
    limit: '8',
    page: '1',
    play_online: '1',
    sort: 'popular',
  })

  addOptionalParam(categoryParams, 'category', category)
  addOptionalParam(developerParams, 'query', developer)

  const [categoryResult, developerResult] = await Promise.all([
    category ? fetchGames(categoryParams).catch(() => null) : null,
    developer ? fetchGames(developerParams).catch(() => null) : null,
  ])

  const relatedByCategory = dedupeGames(categoryResult?.games ?? [])
    .filter((game) => !isSameGame(game, currentId))
    .slice(0, 6)
  const relatedByDeveloper = dedupeGames(developerResult?.games ?? [])
    .filter((game) => !isSameGame(game, currentId))
    .filter((game) => game.developer?.trim() === developer?.trim())
    .slice(0, 6)

  return { relatedByCategory, relatedByDeveloper }
}

async function fetchBlogPosts(params: URLSearchParams) {
  const result = await fetchJson<BlogPostSearchResponse>('/api/blog-posts', params)

  return {
    blogPosts: result.blogPosts,
    pagination: result.pagination,
  } satisfies BlogPostSearchResult
}

export const searchGames = createServerFn({ method: 'GET' })
  .validator((payload: GameSearchPayload) => ({
    query: payload.query ?? '',
    locale: normalizeLocale(payload.locale),
    page: normalizePage(payload.page),
    limit: normalizeLimit(payload.limit),
    platform: payload.platform ?? '',
    category: payload.category ?? '',
    sort: normalizeSort(payload.sort),
  }))
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      is_gcoin_game: NON_GCOIN_GAME,
      page: String(data.page),
      limit: String(data.limit),
      play_online: '1',
    })

    addOptionalParam(params, 'query', data.query)
    addOptionalParam(params, 'platform', data.platform)
    addOptionalParam(params, 'category', data.category)
    addOptionalParam(params, 'sort', data.sort)

    return fetchGames(params)
  })

export const searchLiveRooms = createServerFn({ method: 'GET' })
  .validator((payload: LiveRoomSearchPayload) => ({
    page: normalizePage(payload.page),
    limit: normalizeLimit(payload.limit),
  }))
  .handler(async ({ data }) => {
    if (!hasApprovedGames()) return { rooms: [], pagination: { total: 0, page: data.page, limit: data.limit, pages: 0 } } satisfies LiveRoomSearchResult
    const result = await fetchJson<LiveRoomSearchResponse>(
      '/api/live/rooms',
      new URLSearchParams({
        page: String(data.page),
        limit: String(data.limit),
      }),
    )

    return {
      rooms: result.items.filter((room) => isApprovedGame(room.game)),
      pagination: { ...result.pagination, total: result.items.filter((room) => isApprovedGame(room.game)).length, pages: 1 },
    } satisfies LiveRoomSearchResult
  })

export const getGameFilterOptions = createServerFn({ method: 'GET' })
  .handler(async () => {
    if (!hasApprovedGames()) return { platforms: [], categories: [] } satisfies GameFilterOptions
    try {
      const emptyParams = new URLSearchParams()
      const [platformsResult, genresResult] = await Promise.all([
        fetchJson<FilterOptionResponse>('/api/games/platforms', emptyParams),
        fetchJson<FilterOptionResponse>('/api/games/genres', emptyParams),
      ])

      return {
        platforms: normalizeFilterOptions(platformsResult.data),
        categories: normalizeFilterOptions(genresResult.data),
      } satisfies GameFilterOptions
    } catch {
      // Upstream unreachable: derive the filter lists from the local snapshot.
      const platformCounts = new Map<string, number>()
      const categoryCounts = new Map<string, number>()
      for (const game of snapshotGames) {
        if (game.platform) {
          platformCounts.set(game.platform, (platformCounts.get(game.platform) ?? 0) + 1)
        }
        for (const category of game.categories ?? []) {
          categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
        }
      }
      const toOptions = (counts: Map<string, number>) =>
        [...counts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
      return {
        platforms: toOptions(platformCounts),
        categories: toOptions(categoryCounts),
      } satisfies GameFilterOptions
    }
  })

export const getRandomPlayableGame = createServerFn({ method: 'GET' })
  .validator((payload: RandomGamePayload) => ({
    platform: payload.platform?.trim(),
  }))
  .handler(async ({ data }) => {
    if (!hasApprovedGames()) return null
    const platforms = (await getApprovedCatalog())
      .map((game) => ({ name: game.platform?.trim() ?? '' }))
      .filter((game) => game.name)
    const platform = pickRandomPlatform(data.platform, platforms)
    return fetchRandomPlayableGame(platform)
  })

async function fetchGameDetailOrSnapshot(id: string) {
  // Snapshot first: the local catalog snapshot (refreshed daily by the
  // catalog sync) covers every approved game, and serving from it keeps
  // detail/play pages fast — the live upstream detail call can take
  // several seconds or hang, which timed out play pages in production.
  // The live call remains for games missing from the snapshot.
  const snapshot = getSnapshotGame(id)
  if (snapshot) return snapshot
  const params = new URLSearchParams({ id })
  const result = await fetchJson<GameDetailResponse>('/api/game/detail', params)
  return result.data
}

export const getGameDetail = createServerFn({ method: 'GET' })
  .validator((payload: GameDetailPayload) => ({
    id: payload.id,
  }))
  .handler(async ({ data }) => {
    if (!isApprovedGameId(data.id)) throw new Response('Game not found', { status: 404 })
    const game = await fetchGameDetailOrSnapshot(data.id)
    if (!isApprovedGame(game)) throw new Response('Game not found', { status: 404 })
    return withLocalRom(withLocalCover(game), data.id)
  })

export const getGameDetailPageData = createServerFn({ method: 'GET' })
  .validator((payload: GameDetailPayload) => ({
    id: payload.id,
    locale: normalizeLocale(payload.locale),
  }))
  .handler(async ({ data }) => {
    if (!isApprovedGameId(data.id)) throw new Response('Game not found', { status: 404 })
    const fetched = await fetchGameDetailOrSnapshot(data.id)
    if (!isApprovedGame(fetched)) throw new Response('Game not found', { status: 404 })
    const game = withLocalRom(withLocalCover(fetched), data.id)
    const origin = PRODUCTION_SITE_ORIGIN

    return {
      canonicalUrl: getAbsoluteGameUrl(origin, data.locale, game, data.id),
      game,
    } satisfies GameDetailPageData
  })

export const getRelatedGamePageData = createServerFn({ method: 'GET' })
  .validator((payload: RelatedGamesPayload) => ({
    category: payload.category,
    currentId: payload.currentId,
    developer: payload.developer,
  }))
  .handler(async ({ data }) => {
    if (!hasApprovedGames()) return { relatedByCategory: [], relatedByDeveloper: [] } satisfies RelatedGamesData
    return fetchRelatedGames(data) satisfies Promise<RelatedGamesData>
  })

export const searchBlogPosts = createServerFn({ method: 'GET' })
  .validator((payload: BlogPostSearchPayload) => ({
    keyword: payload.keyword ?? '',
    page: normalizePage(payload.page),
    limit: normalizeLimit(payload.limit),
    includeContent: payload.includeContent ?? false,
  }))
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      page: String(data.page),
      limit: String(data.limit),
    })

    addOptionalParam(params, 'keyword', data.keyword)

    if (data.includeContent) {
      params.set('includeContent', '1')
    }

    return fetchBlogPosts(params)
  })

export const getBlogPostDetailPageData = createServerFn({ method: 'GET' })
  .validator((payload: BlogPostDetailPayload) => ({
    id: payload.id,
    locale: normalizeLocale(payload.locale),
  }))
  .handler(async ({ data }) => {
    const result = await fetchJson<BlogPostDetailResponse>(
      `/api/blog-posts/${encodeURIComponent(data.id)}`,
      new URLSearchParams(),
    )
    const origin = PRODUCTION_SITE_ORIGIN

    return {
      blogPost: result.blogPost,
      canonicalUrl: getAbsoluteBlogPostUrl(
        origin,
        data.locale,
        result.blogPost,
        data.id,
      ),
    } satisfies BlogPostDetailPageData
  })

// --- Tier-1 features: rankings, home rails, collections, cartridges -------
// Data comes from config/rankings-data.json (built daily by
// scripts/build-rankings.mjs from the catalog snapshot) and from the
// snapshot itself, so these pages never wait on the upstream API.

export type RankingBoard = 'latest' | 'popular' | 'rising'

export type RankingEntry = {
  game: PublicGame
  gain?: number
}

export type RankingsPageData = {
  board: RankingBoard
  generatedAt: string
  historyDays: number
  entries: Array<RankingEntry>
}

type RankingsDataFile = {
  generated_at: string
  history_days: number
  latest: Array<string>
  popular: Array<string>
  rising: Array<{ gain: number; id: string }>
}

const rankings = rankingsData as RankingsDataFile

export const getRankingsPageData = createServerFn({ method: 'GET' })
  .validator((payload: { board?: string }) => ({
    board: (payload.board === 'rising' || payload.board === 'latest'
      ? payload.board
      : 'popular') as RankingBoard,
  }))
  .handler(async ({ data }) => {
    const entries: Array<RankingEntry> = []

    if (data.board === 'rising') {
      for (const item of rankings.rising) {
        const game = getSnapshotGame(item.id)
        if (game) entries.push({ game, gain: item.gain })
      }
    } else {
      for (const id of rankings[data.board]) {
        const game = getSnapshotGame(id)
        if (game) entries.push({ game })
      }
    }

    return {
      board: data.board,
      entries,
      generatedAt: rankings.generated_at,
      historyDays: rankings.history_days,
    } satisfies RankingsPageData
  })

export type HomeRailsData = {
  hero: Array<PublicGame>
  latest: Array<PublicGame>
  mahjong: Array<PublicGame>
  popular: Array<PublicGame>
  rising: Array<RankingEntry>
}

export const getHomeRailsData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const catalog = getSnapshotCatalog()
    const byPlays = [...catalog].sort(
      (a, b) => (b.plays_count ?? 0) - (a.plays_count ?? 0),
    )
    const rising: Array<RankingEntry> = []

    for (const item of rankings.rising.slice(0, 10)) {
      const game = getSnapshotGame(item.id)
      if (game) rising.push({ game, gain: item.gain })
    }

    return {
      hero: byPlays.slice(0, 3),
      latest: catalog.slice(0, 10),
      mahjong: matchThemeGames(catalog, 'mahjong').slice(0, 10),
      popular: byPlays.slice(0, 12),
      rising,
    } satisfies HomeRailsData
  },
)

// Theme matchers run over snapshot fields (name + keywords). They mirror
// the themes declared in lib/collections.ts.
function matchThemeGames(
  catalog: Array<PublicGame>,
  themeId: string,
): Array<PublicGame> {
  const nameOf = (game: PublicGame) => game.name ?? ''
  const textOf = (game: PublicGame) =>
    `${game.name ?? ''} ${game.keywords ?? ''}`

  const matchers: Record<string, (game: PublicGame) => boolean> = {
    kof: (game) =>
      nameOf(game).includes('拳皇') || /king of( the)? fighters/i.test(nameOf(game)),
    mahjong: (game) =>
      nameOf(game).includes('麻将') || /mahjong/i.test(nameOf(game)),
    mario: (game) => nameOf(game).includes('马里奥') || /mario/i.test(nameOf(game)),
    pokemon: (game) =>
      nameOf(game).includes('宝可梦') || /pok[eé]mon/i.test(nameOf(game)),
    'three-kingdoms': (game) => textOf(game).includes('三国'),
  }

  const matcher = matchers[themeId]
  if (!matcher) return []

  return catalog
    .filter(matcher)
    .sort((a, b) => (b.plays_count ?? 0) - (a.plays_count ?? 0))
}

export type CollectionPageData = {
  games: Array<PublicGame>
  kind: 'platform' | 'theme'
  platformName?: string
  total: number
}

export const getCollectionPageData = createServerFn({ method: 'GET' })
  .validator((payload: { collectionId: string }) => ({
    collectionId: payload.collectionId,
  }))
  .handler(async ({ data }) => {
    const def = getCollectionDef(data.collectionId)
    if (!def) return null

    const catalog = getSnapshotCatalog()
    const games =
      def.kind === 'platform'
        ? catalog
            .filter((game) => game.platform === def.platformName)
            .sort((a, b) => (b.plays_count ?? 0) - (a.plays_count ?? 0))
        : matchThemeGames(catalog, def.id)

    return {
      games: games.slice(0, 240),
      kind: def.kind,
      platformName: def.platformName,
      total: games.length,
    } satisfies CollectionPageData
  })

export type CartridgeEntry = {
  developer: string
  game: PublicGame
  number: number
  tag: string
  year: string
}

export const getCartridgesPageData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const entries: Array<CartridgeEntry> = []

    for (const cartridge of fcCartridges as Array<{
      approved_id: string
      developer?: string
      tag?: string
      year?: string
    }>) {
      const game = getSnapshotGame(cartridge.approved_id)
      if (!game) continue
      entries.push({
        developer: cartridge.developer ?? '',
        game,
        number: entries.length + 1,
        tag: cartridge.tag ?? '',
        year: cartridge.year ?? '',
      })
    }

    return { entries, total: entries.length }
  },
)
