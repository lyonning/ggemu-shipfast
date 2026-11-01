import approvedGameIds from '../../config/approved-games.json'
import reviews from '../../config/game-rights-reviews.json'

type RightsReview = {
  game_id: string
  status: string
  rights_holder?: string
  license_basis?: string
  evidence_url?: string
  approved_by?: string
  approved_at?: string
  expires_at?: string
  commercial_use?: boolean
  third_party_embed?: boolean
  public_play?: boolean
  territory_confirmed?: boolean
  assets_confirmed?: boolean
}

const reviewedById = new Map<string, RightsReview>(
  (reviews as Array<RightsReview>).map((review) => [review.game_id, review]),
)

function isValidDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value + 'T00:00:00Z')))
}

function isPublicationApproved(id: string) {
  const review = reviewedById.get(id)
  if (!review || review.status !== 'approved') return false
  if (!review.rights_holder?.trim() || !review.license_basis?.trim()
    || !review.evidence_url?.startsWith('https://') || !review.approved_by?.trim()
    || !isValidDate(review.approved_at)) return false
  if (review.expires_at && (!isValidDate(review.expires_at)
    || review.expires_at < new Date().toISOString().slice(0, 10))) return false
  return review.commercial_use === true
    && review.third_party_embed === true
    && review.public_play === true
    && review.territory_confirmed === true
    && review.assets_confirmed === true
}

// A game must be explicitly listed AND have a signed, current rights review.
// Failure to provide an adequate record always hides the game, even if an ID
// was manually added to approved-games.json.
const configuredIds = new Set<string>(approvedGameIds)

function approvedIds() {
  return [...configuredIds].filter((id) => isPublicationApproved(id))
}

export function getApprovedGameIds() {
  return approvedIds()
}

export function hasApprovedGames() {
  return approvedIds().length > 0
}

export function isApprovedGameId(id: string | undefined | null) {
  return Boolean(id && configuredIds.has(id.trim()) && isPublicationApproved(id.trim()))
}

export function isApprovedGame(game: { _id?: string; url_slug?: string }) {
  return isApprovedGameId(game._id) || isApprovedGameId(game.url_slug)
}

export function assertApprovedGame(id: string) {
  if (!isApprovedGameId(id)) {
    throw new Response('Game not found', { status: 404 })
  }
}
