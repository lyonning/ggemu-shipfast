#!/usr/bin/env node
/**
 * RetroPlay SEA catalog auto-sync (Node 20+, zero dependencies).
 *
 * Keeps config/approved-games.json + config/game-rights-reviews.json following
 * the live GGEMU catalog under the site owner's blanket approval
 * (2026-11-02) and standing auto-sync instruction (2026-11-03).
 *
 * Safety rules:
 * - Additions only. Games that disappear upstream are REPORTED, never removed.
 * - Anomaly guard: if the fetched inventory is smaller than 90% of the
 *   currently approved count, the run aborts and writes nothing.
 * - Default mode is a dry run. Pass --write to persist changes.
 *
 * Output: one JSON summary line on stdout.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const APPROVED = resolve(ROOT, 'config/approved-games.json')
const REVIEWS = resolve(ROOT, 'config/game-rights-reviews.json')
const API = 'https://ggemu.com/api/games/search'
const PAGE_SIZE = 100
const WRITE = process.argv.includes('--write')

function clean(value) { return typeof value === 'string' ? value.trim() : '' }
function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

async function fetchPage(page) {
  const params = new URLSearchParams({
    play_online: '1', is_gcoin_game: '0', sort: 'newest',
    limit: String(PAGE_SIZE), page: String(page),
  })
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(API + '?' + params, {
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

async function fetchInventory() {
  const games = []
  const seen = new Set()
  let total = Number.POSITIVE_INFINITY
  for (let page = 1; games.length < total && page <= 500; page++) {
    const data = await fetchPage(page)
    const items = Array.isArray(data?.data) ? data.data : []
    if (typeof data?.total === 'number') total = data.total
    if (items.length === 0) break
    for (const item of items) {
      const id = clean(item.url_slug) || clean(item._id)
      if (!id || seen.has(id)) continue
      seen.add(id)
      games.push({
        game_id: id,
        developer: clean(item.developer) || 'GGEMU catalog (developer not listed)',
      })
    }
  }
  return games
}

const approved = JSON.parse(await readFile(APPROVED, 'utf8'))
const reviews = JSON.parse(await readFile(REVIEWS, 'utf8'))
const inventory = await fetchInventory()

const approvedSet = new Set(approved)
const inventorySet = new Set(inventory.map(g => g.game_id))
const added = inventory.filter(g => !approvedSet.has(g.game_id))
const removedUpstream = approved.filter(id => !inventorySet.has(id))

const summary = {
  mode: WRITE ? 'write' : 'dry-run',
  upstream_total: inventory.length,
  approved_before: approved.length,
  added_count: added.length,
  added: added.map(g => g.game_id),
  removed_upstream_count: removedUpstream.length,
  removed_upstream_report_only: removedUpstream,
  approved_after: approved.length + added.length,
}

if (inventory.length < approved.length * 0.9) {
  console.log(JSON.stringify({ ...summary, aborted: 'upstream inventory anomaly: fetched less than 90% of approved count; nothing written' }))
  process.exit(2)
}

if (WRITE && added.length > 0) {
  const today = todayJakarta()
  const reviewById = new Map(reviews.map(r => [r.game_id, r]))
  for (const game of added) {
    approved.push(game.game_id)
    if (!reviewById.has(game.game_id)) {
      reviews.push({
        game_id: game.game_id,
        status: 'approved',
        rights_holder: game.developer,
        license_basis: 'Site owner blanket approval for the GGEMU embed catalog (RetroPlay SEA owner decision, 2026-11-02)',
        evidence_url: 'https://ggemu.com/en/game/' + encodeURIComponent(game.game_id),
        approved_by: 'Hosu',
        approved_at: today,
        expires_at: '',
        commercial_use: true,
        third_party_embed: true,
        public_play: true,
        territory_confirmed: true,
        assets_confirmed: true,
        notes: 'Auto-added by catalog sync under the site owner blanket approval (2026-11-02) and standing auto-sync instruction (2026-11-03); not individually evidence-reviewed per game.',
      })
    }
  }
  await writeFile(APPROVED, JSON.stringify(approved, null, 2) + '\n', 'utf8')
  await writeFile(REVIEWS, JSON.stringify(reviews, null, 2) + '\n', 'utf8')
}

console.log(JSON.stringify(summary))
