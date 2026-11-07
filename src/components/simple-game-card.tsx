import { Link } from '@tanstack/react-router'

import type { Locale, PublicGame } from '#/lib/ggemu'

// Compact game card shared by the rankings, collection and home-rail
// sections (the catalog grid keeps its own richer card in home/shared).
export function SimpleGameCard({
  game,
  lang,
  rank,
  subline,
}: {
  game: PublicGame
  lang: Locale
  rank?: number
  subline?: string
}) {
  const gameId = game.url_slug || game._id || ''

  return (
    <Link
      className="card card-compact group h-full overflow-hidden border border-base-300 bg-base-100 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
      params={{ gameId, locale: lang }}
      search={{}}
      to="/$locale/games/$gameId"
    >
      <figure className="relative aspect-[4/3] bg-base-300">
        {game.game_cover ? (
          <img
            alt={game.name ?? 'Game cover'}
            className="h-full w-full object-cover"
            loading="lazy"
            src={game.game_cover}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-base-content/40">
            Retro
          </div>
        )}
        {typeof rank === 'number' ? (
          <span
            className={`absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded px-1 text-sm font-bold shadow ${
              rank <= 3
                ? 'bg-amber-400 text-amber-950'
                : 'bg-black/70 text-white'
            }`}
          >
            {rank}
          </span>
        ) : null}
      </figure>
      <div className="card-body gap-1 p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">
          {game.name}
        </h3>
        {subline ? (
          <p className="truncate text-xs text-base-content/55">{subline}</p>
        ) : game.platform ? (
          <p className="truncate text-xs text-base-content/55">
            {game.platform}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

export function formatPlays(count: number | undefined, lang: Locale) {
  const value = count ?? 0
  const compact = new Intl.NumberFormat(lang, {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value)

  if (lang === 'zh-CN') return `${compact} 次游玩`
  if (lang === 'ja') return `${compact} プレイ`
  return `${compact} plays`
}
