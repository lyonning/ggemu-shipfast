#!/usr/bin/env node
/**
 * RetroPlay SEA catalog snapshot (Node 20+, zero dependencies).
 *
 * Builds config/catalog-snapshot.json with full detail data for every
 * approved game, and optionally mirrors cover images into a local assets
 * directory (--covers-dir <dir>). The site uses the snapshot as its local
 * fallback so the catalog keeps working if the GGEMU API is unreachable,
 * and serves covers from our own assets host when a local copy exists.
 *
 * Incremental: re-running refreshes metadata for all approved games and
 * downloads only covers that are missing locally.
 *
 * Output: one JSON summary line on stdout.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const APPROVED = resolve(ROOT, 'config/approved-games.json')
const SNAPSHOT = resolve(ROOT, 'config/catalog-snapshot.json')
const API = 'https://ggemu.com'
const CONCURRENCY = 6

const coversArg = process.argv.indexOf('--covers-dir')
const COVERS_DIR = coversArg >= 0 ? resolve(process.argv[coversArg + 1]) : null

// Fields kept in the snapshot: exactly what the site renders for a game.
const KEEP = [
  '_id', 'url_slug', 'name', 'description', 'how_to_play', 'developer',
  'released_year', 'keywords', 'platform', 'platform_slug', 'categories',
  'languages', 'players', 'play_online', 'play_device', 'downloadable',
  'is_gcoin_game', 'game_cover', 'game_video', 'likes_count',
  'comments_count', 'views_count', 'plays_count', 'file_size',
  'default_gamecontrol', 'net_play', 'live_mode',
]

function clean(value) { return typeof value === 'string' ? value.trim() : '' }

async function fetchJson(url, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(25000),
      })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      return await response.json()
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function mapPool(items, worker) {
  const results = new Array(items.length)
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run))
  return results
}

const approved = JSON.parse(await readFile(APPROVED, 'utf8'))
const approvedSet = new Set(approved)

// Previous snapshot, used to carry over entries for games that have
// been delisted upstream (see the missing-detail handling below).
let prevSnapshot = []
try {
  prevSnapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'))
} catch { /* no previous snapshot yet */ }
const prevByApprovedId = new Map(prevSnapshot.map(g => [g._approved_id, g]))
const prevIndexByApprovedId = new Map(prevSnapshot.map((g, i) => [g._approved_id, i]))

// Page the search API to learn each approved game's upstream _id and its
// position in the upstream newest-first order (the snapshot keeps that
// order so the site's default "newest" listing matches the live catalog).
const upstreamIdByApprovedId = new Map()
const upstreamOrderByApprovedId = new Map()
for (let page = 1; page <= 30; page++) {
  const params = new URLSearchParams({
    play_online: '1', is_gcoin_game: '0', sort: 'newest',
    limit: '100', page: String(page),
  })
  const data = await fetchJson(API + '/api/games/search?' + params)
  const items = Array.isArray(data?.data) ? data.data : []
  if (items.length === 0) break
  for (const item of items) {
    const approvedId = clean(item.url_slug) || clean(item._id)
    if (approvedSet.has(approvedId)) {
      upstreamIdByApprovedId.set(approvedId, clean(item._id))
      if (!upstreamOrderByApprovedId.has(approvedId)) {
        upstreamOrderByApprovedId.set(approvedId, upstreamOrderByApprovedId.size)
      }
    }
  }
}

const details = await mapPool(approved, async (approvedId) => {
  try {
    const data = await fetchJson(API + '/api/game/detail?id=' + encodeURIComponent(approvedId))
    const game = data?.data
    if (!game) return null
    const entry = {}
    for (const key of KEEP) {
      if (game[key] !== undefined && game[key] !== null) entry[key] = game[key]
    }
    entry._approved_id = approvedId
    return entry
  } catch {
    return null
  }
})

const games = details.filter(Boolean)
const missing = approved.filter((id, i) => !details[i])

// A game missing from the detail results is one of two cases:
// - Still listed in the upstream search inventory: its detail fetch
//   failed transiently. It stays in missing_detail and fails the run,
//   so the caller hears about it and keeps the last good snapshot.
// - Gone from the upstream inventory entirely: it was delisted. The
//   catalog here is additions-only, so carry over its previous
//   snapshot entry instead of failing every future run on it.
const carriedOver = []
const stillMissing = []
for (const id of missing) {
  const prev = prevByApprovedId.get(id)
  if (!upstreamIdByApprovedId.has(id) && prev) {
    games.push(prev)
    carriedOver.push(id)
  } else {
    stillMissing.push(id)
  }
}

games.sort((a, b) => {
  const orderA = upstreamOrderByApprovedId.get(a._approved_id) ?? prevIndexByApprovedId.get(a._approved_id) ?? Number.MAX_SAFE_INTEGER
  const orderB = upstreamOrderByApprovedId.get(b._approved_id) ?? prevIndexByApprovedId.get(b._approved_id) ?? Number.MAX_SAFE_INTEGER
  return orderA - orderB
})

// Mirror covers for games whose detail carried a cover URL.
let coverStats = { attempted: 0, downloaded: 0, existing: 0, failed: 0 }
if (COVERS_DIR) {
  await mkdir(resolve(COVERS_DIR, 'covers'), { recursive: true })
  await mkdir(resolve(COVERS_DIR, 'covers-480'), { recursive: true })
  // 480px thumbnails for list/card contexts (see build-cover-thumbs.mjs).
  const ensureThumb = (upstreamId) => {
    const src = resolve(COVERS_DIR, 'covers', upstreamId + '.jpg')
    const dest = resolve(COVERS_DIR, 'covers-480', upstreamId + '.jpg')
    if (existsSync(dest) || !existsSync(src)) return
    spawnSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-i', src, '-vf', "scale='min(480,iw)':-1", '-q:v', '4', dest],
      { encoding: 'utf-8' },
    )
  }
  const coverResults = await mapPool(games, async (game) => {
    const upstreamId = clean(game._id)
    const coverUrl = clean(game.game_cover)
    if (!upstreamId || !coverUrl) return 'none'
    const file = resolve(COVERS_DIR, 'covers', upstreamId + '.jpg')
    try {
      await access(file)
      game.local_cover = true
      ensureThumb(upstreamId)
      return 'existing'
    } catch { /* not downloaded yet */ }
    try {
      const response = await fetch(coverUrl, { signal: AbortSignal.timeout(25000) })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length < 1000) throw new Error('suspiciously small cover')
      await writeFile(file, bytes)
      game.local_cover = true
      ensureThumb(upstreamId)
      return 'downloaded'
    } catch {
      game.local_cover = false
      return 'failed'
    }
  })
  coverStats = {
    attempted: coverResults.filter(r => r !== 'none').length,
    downloaded: coverResults.filter(r => r === 'downloaded').length,
    existing: coverResults.filter(r => r === 'existing').length,
    failed: coverResults.filter(r => r === 'failed').length,
  }
}

await writeFile(SNAPSHOT, JSON.stringify(games), 'utf8')

console.log(JSON.stringify({
  approved: approved.length,
  snapshotted: games.length,
  missing_detail: stillMissing,
  carried_over: carriedOver,
  covers: coverStats,
  snapshot_bytes: Buffer.byteLength(JSON.stringify(games)),
}))
if (stillMissing.length > 0) process.exit(1)
