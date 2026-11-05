#!/usr/bin/env node
/**
 * Phase 2 ROM fetch (Node 20+, zero dependencies).
 *
 * Downloads ROM files for the most-played games whose object URL pattern
 * was verified in docs/phase2-step0-rom-fetch-verification.md:
 *   https://storage.ggemu.com/games/{_id}/game.{ext}
 *
 * Selection: walk the catalog snapshot by plays_count (descending) over
 * the top `--top` games (default 300) and keep those whose platform has a
 * verified extension and a known file_size, up to `--limit` games
 * (default 181 candidates; HEAD failures are reported, not downloaded).
 *
 * Files land in <out-dir>/{_id}/game.{ext} — the same key layout the R2
 * bucket will use (roms/{_id}/game.{ext}). Every file is size-verified
 * against the catalog file_size. A manifest.json with per-game status is
 * written to <out-dir>. Re-running skips files that are already complete.
 *
 * Output: one JSON summary line on stdout.
 */
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const SNAPSHOT = resolve(ROOT, 'config/catalog-snapshot.json')

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : fallback
}
const OUT_DIR = resolve(argValue('--out-dir', resolve(ROOT, '../retroplay-roms')))
const TOP = Number(argValue('--top', '300'))
const LIMIT = Number(argValue('--limit', '181'))
const CONCURRENCY = 4

// Extension map verified in docs/phase2-step0-rom-fetch-verification.md
// (.pce for PC Engine is assumed, not probed — the HEAD check below will
// simply exclude it if it does not exist).
const EXT_BY_PLATFORM = {
  'Famicom': 'nes',
  'Game Boy Advance': 'gba',
  'Super Famicom': 'smc',
  'Genesis': 'md',
  'Nintendo 64': 'n64',
  'Arcade': 'zip',
  'Nintendo DS': 'zip',
  'Game Boy': 'gb',
  'Game Boy Color': 'gbc',
  'Game Gear': 'gg',
  'Master System': 'sms',
  'Sega CD': 'scd',
  'PC Engine': 'pce',
}
const STORAGE_BASE = 'https://storage.ggemu.com/games'

const snapshot = JSON.parse(await readFile(SNAPSHOT, 'utf8'))
const byPlays = [...snapshot].sort((a, b) => (b.plays_count ?? 0) - (a.plays_count ?? 0))
const targets = byPlays
  .slice(0, TOP)
  .filter((game) => EXT_BY_PLATFORM[game.platform] && (game.file_size ?? 0) > 0)
  .slice(0, LIMIT)
  .map((game) => ({
    approved_id: game._approved_id,
    upstream_id: game._id,
    platform: game.platform,
    ext: EXT_BY_PLATFORM[game.platform],
    file_size: game.file_size,
    plays_count: game.plays_count ?? 0,
    url: `${STORAGE_BASE}/${game._id}/game.${EXT_BY_PLATFORM[game.platform]}`,
    status: 'pending',
  }))

async function head(url) {
  const response = await fetch(url, {
    method: 'HEAD',
    signal: AbortSignal.timeout(30000),
  })
  return {
    ok: response.ok,
    status: response.status,
    length: Number(response.headers.get('content-length') ?? 0),
  }
}

async function download(target) {
  const dir = resolve(OUT_DIR, target.upstream_id)
  const file = resolve(dir, `game.${target.ext}`)
  await mkdir(dir, { recursive: true })

  const existing = await stat(file).catch(() => null)
  if (existing && existing.size === target.file_size) {
    target.status = 'already_present'
    return
  }

  const probe = await head(target.url)
  if (!probe.ok || probe.length !== target.file_size) {
    target.status = 'probe_failed'
    target.detail = `HEAD ${probe.status}, length ${probe.length}, expected ${target.file_size}`
    return
  }

  const part = file + '.part'
  let lastError
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(target.url, { signal: AbortSignal.timeout(300000) })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length !== target.file_size) {
        throw new Error(`size mismatch: got ${bytes.length}, expected ${target.file_size}`)
      }
      await writeFile(part, bytes)
      await rename(part, file)
      target.status = 'downloaded'
      return
    } catch (error) {
      lastError = error
    }
  }
  target.status = 'download_failed'
  target.detail = String(lastError)
}

async function mapPool(items, worker) {
  let next = 0
  async function run() {
    while (next < items.length) {
      const index = next++
      await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run))
}

await mkdir(OUT_DIR, { recursive: true })
await mapPool(targets, download)
await writeFile(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(targets, null, 2), 'utf8')

const count = (status) => targets.filter((t) => t.status === status).length
const fetched = targets.filter((t) => t.status === 'downloaded' || t.status === 'already_present')
console.log(JSON.stringify({
  candidates: targets.length,
  downloaded: count('downloaded'),
  already_present: count('already_present'),
  probe_failed: targets.filter((t) => t.status === 'probe_failed')
    .map((t) => ({ id: t.approved_id, detail: t.detail })),
  download_failed: targets.filter((t) => t.status === 'download_failed')
    .map((t) => ({ id: t.approved_id, detail: t.detail })),
  fetched_games: fetched.length,
  fetched_bytes: fetched.reduce((sum, t) => sum + t.file_size, 0),
}))
