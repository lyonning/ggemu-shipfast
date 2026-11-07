#!/usr/bin/env node
/**
 * RetroPlay rankings data builder (Node 20+, zero dependencies).
 *
 * Derives config/rankings-data.json from the local catalog snapshot:
 * - popular: top 100 by all-time plays_count
 * - rising:  top 100 by plays gained since the oldest day kept in
 *            config/plays-history.json (needs at least 2 history days,
 *            otherwise the board is empty)
 * - latest:  first 100 in snapshot order (newest first)
 *
 * Also maintains config/plays-history.json: one entry per day mapping
 * approved_id -> plays_count, pruned to the last 14 days. Run after
 * scripts/snapshot-catalog.mjs refreshes the snapshot (the daily
 * catalog sync does both).
 *
 * Output: one JSON summary line on stdout.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const SNAPSHOT = resolve(ROOT, 'config/catalog-snapshot.json')
const HISTORY = resolve(ROOT, 'config/plays-history.json')
const OUTPUT = resolve(ROOT, 'config/rankings-data.json')
const BOARD_LIMIT = 100
const HISTORY_DAYS = 14

function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return fallback
  }
}

const snapshot = await readJson(SNAPSHOT, [])
const games = snapshot.filter((game) => game?._approved_id)
const playsById = new Map(games.map((game) => [game._approved_id, game.plays_count || 0]))

// --- maintain the daily plays history -------------------------------------
const history = await readJson(HISTORY, {})
history[todayJakarta()] = Object.fromEntries(playsById)
const days = Object.keys(history).sort()
for (const day of days.slice(0, Math.max(0, days.length - HISTORY_DAYS))) {
  delete history[day]
}
await writeFile(HISTORY, JSON.stringify(history))

// --- build the boards ------------------------------------------------------
const popular = [...games]
  .sort((a, b) => (b.plays_count || 0) - (a.plays_count || 0))
  .slice(0, BOARD_LIMIT)
  .map((game) => game._approved_id)

const keptDays = Object.keys(history).sort()
let rising = []
if (keptDays.length >= 2) {
  const base = history[keptDays[0]]
  rising = games
    .map((game) => ({
      gain: (game.plays_count || 0) - (base[game._approved_id] || 0),
      id: game._approved_id,
    }))
    .filter((entry) => entry.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, BOARD_LIMIT)
}

const latest = games.slice(0, BOARD_LIMIT).map((game) => game._approved_id)

await writeFile(
  OUTPUT,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      history_days: keptDays.length,
      latest,
      popular,
      rising,
    },
    null,
    2,
  ) + '\n',
)

console.log(
  JSON.stringify({
    games: games.length,
    history_days: keptDays.length,
    latest: latest.length,
    popular: popular.length,
    rising: rising.length,
  }),
)
