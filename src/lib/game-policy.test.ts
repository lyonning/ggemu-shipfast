import { describe, expect, it } from 'vitest'
import { getApprovedGameIds, hasApprovedGames, isApprovedGame, isApprovedGameId } from './game-policy'

describe('game publication policy', () => {
  it('starts with no implicitly approved games', () => {
    expect(getApprovedGameIds()).toEqual([])
    expect(hasApprovedGames()).toBe(false)
  })

  it('rejects unknown IDs and upstream game objects', () => {
    expect(isApprovedGameId('unknown-game')).toBe(false)
    expect(isApprovedGameId('')).toBe(false)
    expect(isApprovedGame({ _id: 'unknown-game', url_slug: 'unknown-slug' })).toBe(false)
  })
})
