import approvedGameIds from '../../config/approved-games.json'

// Only explicitly approved game IDs or slugs may be published.
const approvedIds = new Set<string>(approvedGameIds)

export function getApprovedGameIds() {
  return [...approvedIds]
}

export function hasApprovedGames() {
  return approvedIds.size > 0
}

export function isApprovedGameId(id: string | undefined | null) {
  return Boolean(id && approvedIds.has(id.trim()))
}

export function isApprovedGame(game: { _id?: string; url_slug?: string }) {
  return isApprovedGameId(game._id) || isApprovedGameId(game.url_slug)
}

export function assertApprovedGame(id: string) {
  if (!isApprovedGameId(id)) {
    throw new Response('Game not found', { status: 404 })
  }
}
