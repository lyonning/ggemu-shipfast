#!/usr/bin/env node
/**
 * Phase 2 ROM fetch — recovery pass (Node 20+, zero dependencies).
 *
 * Handles the games whose ROM was not at the primary
 * storage.ggemu.com/games/{_id}/game.{ext} URL (see manifest.json from
 * fetch-roms.mjs):
 *
 * 1. Known alternate storage extensions (probed 2026-11-05, HEAD
 *    Content-Length == file_size): fetched straight from storage.
 * 2. Everything else goes through GGEMU's own download endpoint, the
 *    same flow its download page uses:
 *      POST /api/game/download/{_id}   (Referer: the download page)
 *      → { download_url } → GET that URL with the same Referer.
 *    The served filename comes from Content-Disposition; the bytes are
 *    stored exactly as served and size-verified against file_size.
 *
 * Updates manifest.json in place. Output: one JSON summary line.
 */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve } from 'node:path'

const run = promisify(execFile)

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : fallback
}
const OUT_DIR = resolve(argValue('--out-dir', resolve(process.cwd(), '../retroplay-roms')))
const STORAGE_BASE = 'https://storage.ggemu.com/games'

// Alternate storage extensions verified by HEAD probes on 2026-11-05.
const KNOWN_ALT_EXT = {
  'pokemon-emerald-gba-2004': 'zip',
  'taiko-no-tatsujin-ds-touch-de-dokodon-nds-2005': 'nds',
  'labrador-and-his-friends-nintendo-ds-2009': 'nds',
  'nintendogs-labrador-friends-nds-2005': 'nds',
  '69db25ef2a69d0f598a603a4': 'nds',
  'cooking-mama-nds-2006': 'nds',
  'bruce-lee-return-of-the-legend-gba-2003': 'zip',
  'ghost-chaser-densei-snes-1994': 'sfc',
  'naruto-saikyou-ninja-daikesshuu-2-gba-2003': 'zip',
  'final-fight-3-snes-1992': 'sfc',
  // HEAD returned 200 without a Content-Length for this one; a plain GET
  // with size verification is the correct probe.
  'tiny-toon-adventures-busters-hidden-treasure-genesis-1993': 'md',
}

const manifestPath = resolve(OUT_DIR, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const pending = manifest.filter((t) => t.status === 'probe_failed')

async function fetchFromStorage(target, ext) {
  const dir = resolve(OUT_DIR, target.upstream_id)
  await mkdir(dir, { recursive: true })
  const file = resolve(dir, `game.${ext}`)
  const url = `${STORAGE_BASE}/${target.upstream_id}/game.${ext}`
  const response = await fetch(url, { signal: AbortSignal.timeout(300000) })
  if (!response.ok) throw new Error('HTTP ' + response.status)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length !== target.file_size) {
    throw new Error(`size mismatch: got ${bytes.length}, expected ${target.file_size}`)
  }
  await writeFile(file + '.part', bytes)
  await rename(file + '.part', file)
  target.ext = ext
  target.url = url
  target.status = 'downloaded_alt_ext'
}

async function fetchViaEndpoint(target) {
  const pageId = target.approved_id // slug, or the upstream _id for slug-less games
  const referer = `https://ggemu.com/en/download/${pageId}`
  const post = await run('curl', [
    '-s', '-X', 'POST', `https://ggemu.com/api/game/download/${target.upstream_id}`,
    '-H', `Referer: ${referer}`, '-H', 'Origin: https://ggemu.com', '--max-time', '60',
  ])
  const data = JSON.parse(post.stdout)
  if (!data.success || !data.download_url) {
    throw new Error('download POST failed: ' + post.stdout.slice(0, 120))
  }
  const dir = resolve(OUT_DIR, target.upstream_id)
  await mkdir(dir, { recursive: true })
  const part = resolve(dir, 'game.download.part')
  const headersFile = resolve(dir, 'headers.tmp')
  await run('curl', [
    '-s', '-L', `https://ggemu.com${data.download_url}`,
    '-H', `Referer: ${referer}`, '-D', headersFile, '-o', part, '--max-time', '900',
  ], { maxBuffer: 1024 * 1024 })
  const headers = await readFile(headersFile, 'utf8')
  const match = headers.match(/filename="[^"]*\.([A-Za-z0-9]+)"/)
  const ext = match ? match[1].toLowerCase() : 'bin'
  const { size } = await import('node:fs').then((fs) => fs.promises.stat(part))
  if (size !== target.file_size) {
    throw new Error(`size mismatch: got ${size}, expected ${target.file_size}`)
  }
  const file = resolve(dir, `game.${ext}`)
  await rename(part, file)
  await run('rm', ['-f', headersFile])
  target.ext = ext
  target.url = `endpoint:/api/game/download/${target.upstream_id}`
  target.status = 'downloaded_via_endpoint'
}

for (const target of pending) {
  try {
    const alt = KNOWN_ALT_EXT[target.approved_id]
    if (alt) await fetchFromStorage(target, alt)
    else await fetchViaEndpoint(target)
    console.log('OK  ', target.approved_id, '->', target.status, 'game.' + target.ext)
  } catch (error) {
    target.status = 'recovery_failed'
    target.detail = String(error).slice(0, 300)
    console.log('FAIL', target.approved_id, '->', target.detail)
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
}

const byStatus = {}
for (const t of manifest) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
const fetched = manifest.filter((t) => t.status.startsWith('downloaded') || t.status === 'already_present')
console.log(JSON.stringify({
  by_status: byStatus,
  fetched_games: fetched.length,
  fetched_bytes: fetched.reduce((sum, t) => sum + t.file_size, 0),
}))
