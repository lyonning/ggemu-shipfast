import { describe, expect, it } from 'vitest'
import { getApprovedGameIds, isApprovedGame, isApprovedGameId } from './game-policy'

describe('game publication policy', () => {
  it('accepts only configured IDs, with no implicit approvals', () => {
    const ids = getApprovedGameIds()
    expect(ids).toEqual([...new Set(ids)])
    expect(isApprovedGameId('__unapproved_test_game__')).toBe(false)
    expect(isApprovedGameId('')).toBe(false)
    expect(isApprovedGame({ _id: '__unapproved_test_game__', url_slug: '__unknown_slug__' })).toBe(false)
    for (const id of ids) {
      expect(isApprovedGameId(id)).toBe(true)
    }
  })
})
