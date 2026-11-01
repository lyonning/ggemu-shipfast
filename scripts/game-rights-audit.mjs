#!/usr/bin/env node
/**
 * RetroPlay SEA rights review pipeline (Node 20+, zero dependencies).
 * Inventory is metadata only. Neither the GGEMU API nor this script grants rights.
 * No command in this script writes to config/approved-games.json.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const INVENTORY = resolve(ROOT, 'reports/game-rights/inventory.json')
const REVIEWS = resolve(ROOT, 'config/game-rights-reviews.json')
const REPORT = resolve(ROOT, 'reports/game-rights/review-report.csv')
const SUMMARY = resolve(ROOT, 'reports/game-rights/summary.json')
const APPROVED = resolve(ROOT, 'config/approved-games.json')
const API = 'https://ggemu.com/api/games/search'
const PAGE_SIZE = 100
const MAX_PAGES = 500
const statuses = new Set(['approved', 'unknown', 'needs_permission', 'prohibited'])

function fail(message) { throw new Error(message) }
function clean(value) { return typeof value === 'string' ? value.trim() : '' }
function normalizeId(game) { return clean(game.url_slug) || clean(game._id) }
function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) }
function normalizeGame(game) {
  return {
    game_id: normalizeId(game),
    upstream_id: clean(game._id),
    slug: clean(game.url_slug),
    game_name: clean(game.name),
    platform: clean(game.platform) || clean(game.platform_slug) || clean(game.platformSlug),
    developer: clean(game.developer),
    released_year: clean(game.released_year),
    upstream_url: normalizeId(game)
      ? 'https://ggemu.com/en/game/' + encodeURIComponent(normalizeId(game))
      : '',
  }
}
function csvCell(input) {
  const value = String(input ?? '')
  return /[,"\r\n]/.test(value) ? '"' + value.replaceAll('"', '""') + '"' : value
}
function csv(rows) { return rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n' }
async function jsonFile(path) { return JSON.parse(await readFile(path, 'utf8')) }
async function output(path, value) {
  await mkdir(resolve(path, '..'), { recursive: true })
  await writeFile(path, value, 'utf8')
}
function toKeyMap(items) {
  const map = new Map()
  for (const item of items) {
    for (const key of [item.game_id, item.upstream_id, item.slug]) {
      if (key) map.set(key, item)
    }
  }
  return map
}
function reviewFor(game, reviews) {
  const candidates = [game.game_id, game.upstream_id, game.slug]
    .filter(Boolean).map(id => reviews.get(id)).filter(Boolean)
  if (new Set(candidates).size > 1) fail('Conflicting reviews for game ' + game.game_id)
  return candidates[0] ?? null
}
function rightsComplete(review) {
  if (!review || review.status !== 'approved') return false
  if (!clean(review.rights_holder) || !clean(review.license_basis)) return false
  if (!clean(review.evidence_url) || !/^https:\/\//.test(review.evidence_url)) return false
  if (!clean(review.approved_by) || !validDate(review.approved_at)) return false
  if (review.expires_at && (!validDate(review.expires_at) || review.expires_at < new Date().toISOString().slice(0, 10))) return false
  return review.commercial_use === true
    && review.third_party_embed === true
    && review.public_play === true
    && review.territory_confirmed === true
    && review.assets_confirmed === true
}
function validateReviewRecords(records) {
  if (!Array.isArray(records)) fail('Reviews must be a JSON array')
  const seen = new Set()
  for (const item of records) {
    if (!item || typeof item !== 'object' || !clean(item.game_id)) fail('Every review requires game_id')
    if (seen.has(item.game_id)) fail('Duplicate reviewed game: ' + item.game_id)
    seen.add(item.game_id)
    if (!statuses.has(item.status)) fail('Invalid status for ' + item.game_id)
    if (item.status === 'approved' && !rightsComplete(item)) fail('Approved record missing full rights evidence or signed review: ' + item.game_id)
  }
}
async function fetchPage(page) {
  const query = new URLSearchParams({
    page: String(page), limit: String(PAGE_SIZE),
    play_online: '1', is_gcoin_game: '0', sort: 'newest',
  })
  const url = API + '?' + query.toString()
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(25000) })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const value = await response.json()
      if (!Array.isArray(value.data) || !value.pagination) fail('Unexpected GGEMU API shape on page ' + page)
      return value
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000))
    }
  }
  fail('Failed to fetch page ' + page + ': ' + String(lastError))
}
async function inventory() {
  const first = await fetchPage(1)
  const pages = Number(first.pagination.pages)
  if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) fail('Unsafe page count: ' + pages)
  const items = [...first.data]
  for (let page = 2; page <= pages; page++) {
    const result = await fetchPage(page)
    items.push(...result.data)
    if (page % 10 === 0) console.log('Fetched', page, 'of', pages, 'pages')
  }
  const gameMap = new Map()
  for (const raw of items) {
    const game = normalizeGame(raw)
    if (!game.game_id) fail('Upstream game missing ID/slug')
    if (gameMap.has(game.game_id)) continue
    gameMap.set(game.game_id, game)
  }
  // Do not silently accept a truncated inventory.
  const total = Number(first.pagination.total)
  if (Number.isFinite(total) && total > 0 && items.length < total) {
    fail('API returned fewer entries than reported total (' + items.length + '/' + total + '); inventory not saved')
  }
  const result = {
    source: API, fetched_at: new Date().toISOString(),
    upstream_reported_total: Number.isFinite(total) ? total : null,
    fetched_raw_count: items.length,
    unique_game_count: gameMap.size,
    games: [...gameMap.values()].sort((a, b) => a.game_id.localeCompare(b.game_id)),
  }
  await output(INVENTORY, JSON.stringify(result, null, 2) + '\n')
  console.log('Inventory saved:', result.unique_game_count, 'unique games (upstream total:', result.upstream_reported_total, ')')
}
async function readReviews() {
  const reviews = await jsonFile(REVIEWS)
  validateReviewRecords(reviews)
  return reviews
}
async function report() {
  const inventoryData = await jsonFile(INVENTORY)
  if (!Array.isArray(inventoryData.games)) fail('Invalid inventory; run inventory first')
  const reviews = await readReviews()
  const byId = new Map(reviews.map(x => [x.game_id, x]))
  const inventoryIndex = toKeyMap(inventoryData.games)
  const summary = { inventory_count: inventoryData.games.length, approved: 0, unknown: 0, needs_permission: 0, prohibited: 0, publish_allowed: 0, review_count: reviews.length, unmatched_reviews: [] }
  const headers = ['game_id','game_name','platform','developer','upstream_url','rights_holder','license_basis','evidence_url','risk_class','license_status','commercial_use','third_party_embed','public_play','territory_confirmed','assets_confirmed','approved_by','approved_at','expires_at','publish_allowed','notes']
  const rows = [headers]
  for (const game of inventoryData.games) {
    const review = reviewFor(game, byId)
    const status = review?.status ?? 'unknown'
    summary[status]++
    const allowed = rightsComplete(review)
    if (allowed) summary.publish_allowed++
    const risk = status === 'approved' ? 'A_verified'
      : status === 'needs_permission' ? 'C_missing_permission'
      : status === 'prohibited' ? 'D_do_not_publish' : 'B_unverified'
    rows.push([
      game.game_id, game.game_name, game.platform, game.developer, game.upstream_url,
      review?.rights_holder, review?.license_basis, review?.evidence_url, risk, status,
      review?.commercial_use, review?.third_party_embed, review?.public_play,
      review?.territory_confirmed, review?.assets_confirmed,
      review?.approved_by, review?.approved_at, review?.expires_at,
      allowed ? 'YES' : 'NO', review?.notes,
    ])
  }
  for (const review of reviews) {
    if (!inventoryIndex.has(review.game_id)) summary.unmatched_reviews.push(review.game_id)
  }
  await output(REPORT, csv(rows))
  await output(SUMMARY, JSON.stringify({ ...summary, upstream_reported_total: inventoryData.upstream_reported_total, fetched_at: inventoryData.fetched_at }, null, 2) + '\n')
  console.log('Report ready:', REPORT, '\n', JSON.stringify(summary, null, 2))
}
async function validate() {
  const reviews = await readReviews()
  const records = new Map(reviews.map(x => [x.game_id, x]))
  const approvedIds = await jsonFile(APPROVED)
  if (!Array.isArray(approvedIds) || approvedIds.some(id => !clean(id))) fail('approved-games.json must contain nonempty string IDs')
  if (new Set(approvedIds).size !== approvedIds.length) fail('Duplicate approved game IDs')
  for (const id of approvedIds) {
    const record = records.get(id)
    if (!rightsComplete(record)) fail('BLOCKED: ' + id + ' lacks a reviewed permission record matching this exact ID')
  }
  console.log('Publication gate PASS: ' + approvedIds.length + ' manually approved IDs. No files modified.')
}
const command = process.argv[2]
try {
  if (command === 'inventory') await inventory()
  else if (command === 'report') await report()
  else if (command === 'validate') await validate()
  else fail('Usage: node scripts/game-rights-audit.mjs <inventory|report|validate>')
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
