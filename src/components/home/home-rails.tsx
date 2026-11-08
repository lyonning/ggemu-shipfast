import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'

import { SimpleGameCard, formatPlays } from '#/components/simple-game-card'
import {
  searchLiveRooms,
  type HomeRailsData,
  type Locale,
  type PublicGame,
  type PublicLiveRoom,
} from '#/lib/ggemu'

// Homepage discovery layer (hero carousel, live strip, ranked rails),
// modeled on what comparable retro portals do well: lead with the hits,
// show that other people are playing right now, and give every taste a
// rail. All game data comes from the local snapshot via getHomeRailsData.

const copy: Record<
  Locale,
  {
    playNow: string
    liveTitle: string
    liveNow: string
    popularTitle: string
    popularSub: string
    risingTitle: string
    risingSub: string
    latestTitle: string
    latestSub: string
    mahjongTitle: string
    mahjongSub: string
    viewAll: string
    gainSuffix: string
    randomTitle: string
    randomCta: string
    stripArcade: string
    stripFamicom: string
    stripGba: string
    stripCartridges: string
    stripRankings: string
    stripWishlist: string
  }
> = {
  'zh-CN': {
    playNow: '立即玩',
    liveTitle: '看此时别人在玩什么',
    liveNow: '联机中',
    popularTitle: '热门游戏',
    popularSub: '回到童年的快乐，想玩的都会有',
    risingTitle: '人气飙升',
    risingSub: '这两天突然火起来的，先玩为敬',
    latestTitle: '最新入库',
    latestSub: '刚上架的新面孔，手慢无',
    mahjongTitle: '街机麻将',
    mahjongSub: '不用凑人，随时开一局',
    viewAll: '查看全部',
    gainSuffix: '次新增游玩',
    randomTitle: '每日随机玩一玩',
    randomCta: '随机一款',
    stripArcade: '街机',
    stripFamicom: 'FC游戏机',
    stripGba: 'GBA游戏机',
    stripCartridges: 'FC卡带收藏',
    stripRankings: '排行榜',
    stripWishlist: '愿望单',
  },
  en: {
    playNow: 'Play now',
    liveTitle: 'See what others are playing right now',
    liveNow: 'In a room',
    popularTitle: 'Popular Games',
    popularSub: 'The childhood favorites, all here',
    risingTitle: 'Rising Fast',
    risingSub: 'Heating up over the last few days',
    latestTitle: 'Newest Additions',
    latestSub: 'Fresh on the shelf',
    mahjongTitle: 'Arcade Mahjong',
    mahjongSub: 'No need to gather four players',
    viewAll: 'View all',
    gainSuffix: 'new plays',
    randomTitle: 'Daily Random Pick',
    randomCta: 'Surprise me',
    stripArcade: 'Arcade',
    stripFamicom: 'Famicom',
    stripGba: 'GBA',
    stripCartridges: 'FC Cartridges',
    stripRankings: 'Rankings',
    stripWishlist: 'Wishlist',
  },
  ja: {
    playNow: '今すぐプレイ',
    liveTitle: '今みんなが遊んでいるゲーム',
    liveNow: 'ルームあり',
    popularTitle: '人気ゲーム',
    popularSub: '子供の頃の楽しさが、ここに全部',
    risingTitle: '急上昇',
    risingSub: 'ここ数日で一気に伸びたタイトル',
    latestTitle: '新着ゲーム',
    latestSub: '追加されたばかりの新顔',
    mahjongTitle: 'アーケード麻雀',
    mahjongSub: '人数を集めなくても、いつでも一局',
    viewAll: 'すべて見る',
    gainSuffix: '新規プレイ',
    randomTitle: '今日のランダム',
    randomCta: 'ランダムで選ぶ',
    stripArcade: 'アーケード',
    stripFamicom: 'ファミコン',
    stripGba: 'GBA',
    stripCartridges: 'FCカセット収蔵',
    stripRankings: 'ランキング',
    stripWishlist: 'ほしいもの',
  },
}

export function HomeHeroCarousel({
  games,
  lang,
}: {
  games: Array<PublicGame>
  lang: Locale
}) {
  const t = copy[lang]
  const [index, setIndex] = useState(0)
  // Bumped on every manual navigation so the auto-rotate timer restarts
  // instead of firing right after a manual switch.
  const [cycleKey, setCycleKey] = useState(0)
  // Finger-follow drag state: while dragging, the track is translated by
  // the raw finger delta with no CSS transition; on release the target
  // slide snaps in with an eased transition.
  const [drag, setDrag] = useState<{ offset: number; startX: number } | null>(
    null,
  )
  const suppressClickRef = useRef(false)
  const viewportRef = useRef<HTMLDivElement>(null)

  const isDragging = drag !== null

  useEffect(() => {
    if (games.length < 2 || isDragging) return
    const id = window.setInterval(
      () => setIndex((current) => (current + 1) % games.length),
      5000,
    )
    return () => window.clearInterval(id)
  }, [games.length, cycleKey, isDragging])

  if (games.length === 0) return null

  function goTo(nextIndex: number) {
    setIndex(((nextIndex % games.length) + games.length) % games.length)
    setCycleKey((current) => current + 1)
  }

  function handleTouchStart(event: React.TouchEvent) {
    const startX = event.touches[0]?.clientX
    if (startX === undefined) return
    setDrag({ offset: 0, startX })
  }

  function handleTouchMove(event: React.TouchEvent) {
    if (!drag) return
    const currentX = event.touches[0]?.clientX
    if (currentX === undefined) return
    let offset = currentX - drag.startX
    // Rubber-band resistance when dragging past the first/last slide.
    const pastStart = index === 0 && offset > 0
    const pastEnd = index === games.length - 1 && offset < 0
    if (pastStart || pastEnd) offset *= 0.35
    setDrag({ ...drag, offset })
  }

  function handleTouchEnd() {
    if (!drag) return
    const width = viewportRef.current?.clientWidth ?? 0
    const threshold = Math.max(50, width * 0.18)
    const { offset } = drag
    setDrag(null)
    if (Math.abs(offset) > 8) {
      // The finger travelled: swallow the click that follows touchend so
      // a swipe starting on the play button does not also open the game.
      suppressClickRef.current = true
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 350)
    }
    if (offset <= -threshold) goTo(index + 1)
    else if (offset >= threshold) goTo(index - 1)
    else setCycleKey((current) => current + 1)
  }

  function handleClickCapture(event: React.MouseEvent) {
    if (suppressClickRef.current) {
      event.preventDefault()
      event.stopPropagation()
      suppressClickRef.current = false
    }
  }

  return (
    <section className="bg-base-200">
      <div className="relative mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div
          className="relative touch-pan-y overflow-hidden rounded-box bg-black shadow"
          onClickCapture={handleClickCapture}
          onTouchCancel={handleTouchEnd}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
          ref={viewportRef}
        >
          <div
            className="flex"
            style={{
              transform: `translateX(calc(${-index * 100}% + ${drag?.offset ?? 0}px))`,
              transition: isDragging
                ? 'none'
                : 'transform 480ms cubic-bezier(0.22, 0.9, 0.28, 1)',
            }}
          >
            {games.map((game) => {
              const gameId = game.url_slug || game._id || ''

              return (
                <div
                  className="relative w-full shrink-0"
                  key={game._id ?? game.url_slug ?? gameId}
                >
                  {game.game_cover ? (
                    <img
                      alt={game.name ?? 'Game cover'}
                      className="h-52 w-full select-none object-cover opacity-70 sm:h-72"
                      draggable={false}
                      src={game.game_cover}
                    />
                  ) : (
                    <div className="h-52 w-full bg-base-300 sm:h-72" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-4 sm:p-6">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                        {game.platform}
                      </p>
                      <h2 className="mt-1 line-clamp-2 text-2xl font-bold text-white sm:text-3xl">
                        {game.name}
                      </h2>
                      <p className="mt-1 text-sm text-white/75">
                        {formatPlays(game.plays_count, lang)}
                      </p>
                    </div>
                    <Link
                      className="btn btn-primary shadow-lg"
                      params={{ gameId, locale: lang }}
                      search={{}}
                      to="/$locale/games/$gameId/play"
                    >
                      <i className="ri-play-fill" />
                      {t.playNow}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
          {games.length > 1 ? (
            <div className="absolute right-4 top-4 z-10 flex gap-1.5">
              {games.map((item, itemIndex) => (
                <button
                  aria-label={item.name ?? `Slide ${itemIndex + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    itemIndex === index ? 'w-6 bg-white' : 'w-2 bg-white/50'
                  }`}
                  key={item._id ?? item.url_slug ?? itemIndex}
                  onClick={() => goTo(itemIndex)}
                  type="button"
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function LiveNowStrip({ lang }: { lang: Locale }) {
  const t = copy[lang]
  const runSearch = useServerFn(searchLiveRooms)
  const [rooms, setRooms] = useState<Array<PublicLiveRoom>>([])

  useEffect(() => {
    let disposed = false

    async function load() {
      try {
        const result = await runSearch({ data: { limit: 10, page: 1 } })
        if (!disposed) setRooms(result.rooms)
      } catch {
        // No live rooms to show; the strip stays hidden.
      }
    }

    load()
    const id = window.setInterval(load, 60_000)
    return () => {
      disposed = true
      window.clearInterval(id)
    }
  }, [runSearch])

  if (rooms.length === 0) return null

  return (
    <section className="bg-base-200">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <h2 className="text-sm font-semibold text-base-content">
            {t.liveTitle}
          </h2>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rooms.map((room) => {
            const gameId = room.game.url_slug || room.game.slug || room.game._id

            return (
              <Link
                className="flex shrink-0 items-center gap-2 rounded-full border border-base-300 bg-base-100 py-1 pl-1 pr-3 shadow-sm transition hover:border-primary/40"
                key={room.roomId}
                params={{ gameId, locale: lang }}
                search={{}}
                to="/$locale/games/$gameId"
              >
                {room.game.game_cover ? (
                  <img
                    alt={room.game.name}
                    className="h-7 w-7 rounded-full object-cover"
                    loading="lazy"
                    src={room.game.game_cover}
                  />
                ) : null}
                <span className="max-w-40 truncate text-xs font-medium text-base-content">
                  {room.game.name}
                </span>
                <span className="text-[11px] text-base-content/50">
                  {t.liveNow}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function RailSection({
  children,
  lang,
  sub,
  title,
  to,
  search,
}: {
  children: React.ReactNode
  lang: Locale
  sub: string
  title: string
  to: '/$locale/platform/$collectionId' | '/$locale/rankings'
  search?: { board: 'latest' | 'popular' | 'rising' }
}) {
  const t = copy[lang]

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-base-content">{title}</h2>
          <p className="mt-0.5 text-sm text-base-content/60">{sub}</p>
        </div>
        {to === '/$locale/rankings' ? (
          <Link
            className="shrink-0 text-sm font-medium text-primary"
            params={{ locale: lang }}
            search={search ?? {}}
            to="/$locale/rankings"
          >
            {t.viewAll} →
          </Link>
        ) : (
          <Link
            className="shrink-0 text-sm font-medium text-primary"
            params={{ collectionId: 'mahjong', locale: lang }}
            to="/$locale/platform/$collectionId"
          >
            {t.viewAll} →
          </Link>
        )}
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  )
}

function RailCard({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="w-24 shrink-0 sm:w-44">{children}</div>
}

export function HomeRails({
  lang,
  rails,
}: {
  lang: Locale
  rails: HomeRailsData
}) {
  const t = copy[lang]

  return (
    <>
      {rails.popular.length > 0 ? (
        <RailSection
          lang={lang}
          search={{ board: 'popular' }}
          sub={t.popularSub}
          title={t.popularTitle}
          to="/$locale/rankings"
        >
          {rails.popular.map((game, index) => (
            <RailCard key={game._id ?? game.url_slug ?? index}>
              <SimpleGameCard
                game={game}
                lang={lang}
                subline={formatPlays(game.plays_count, lang)}
              />
            </RailCard>
          ))}
        </RailSection>
      ) : null}

      {rails.rising.length > 0 ? (
        <RailSection
          lang={lang}
          search={{ board: 'rising' }}
          sub={t.risingSub}
          title={t.risingTitle}
          to="/$locale/rankings"
        >
          {rails.rising.map((entry, index) => (
            <RailCard key={entry.game._id ?? entry.game.url_slug ?? index}>
              <SimpleGameCard
                game={entry.game}
                lang={lang}
                subline={`+${(entry.gain ?? 0).toLocaleString(lang)} ${t.gainSuffix}`}
              />
            </RailCard>
          ))}
        </RailSection>
      ) : null}

      {rails.latest.length > 0 ? (
        <RailSection
          lang={lang}
          search={{ board: 'latest' }}
          sub={t.latestSub}
          title={t.latestTitle}
          to="/$locale/rankings"
        >
          {rails.latest.map((game, index) => (
            <RailCard key={game._id ?? game.url_slug ?? index}>
              <SimpleGameCard game={game} lang={lang} />
            </RailCard>
          ))}
        </RailSection>
      ) : null}

      {rails.mahjong.length > 0 ? (
        <RailSection
          lang={lang}
          sub={t.mahjongSub}
          title={t.mahjongTitle}
          to="/$locale/platform/$collectionId"
        >
          {rails.mahjong.map((game, index) => (
            <RailCard key={game._id ?? game.url_slug ?? index}>
              <SimpleGameCard game={game} lang={lang} />
            </RailCard>
          ))}
        </RailSection>
      ) : null}
    </>
  )
}

// Mobile-only colored strip navigation (ucg999-style): full-bleed
// two-column rows that vanish at the lg breakpoint. Pure CSS, no JS.
export function MobileStripNav({ lang }: { lang: Locale }) {
  const t = copy[lang]
  const rows: Array<{
    className: string
    items: Array<{ collectionId?: string; label: string; to: 'collection' | 'rankings' | 'wishlist' }>
  }> = [
    {
      className: 'bg-blue-600 text-white',
      items: [
        { collectionId: 'arcade', label: t.stripArcade, to: 'collection' },
        { collectionId: 'fc-cartridges', label: t.stripCartridges, to: 'collection' },
      ],
    },
    {
      className: 'bg-amber-300 text-black',
      items: [
        { collectionId: 'famicom', label: t.stripFamicom, to: 'collection' },
        { collectionId: 'game-boy-advance', label: t.stripGba, to: 'collection' },
      ],
    },
    {
      className: 'bg-violet-200 text-violet-950',
      items: [
        { label: t.stripRankings, to: 'rankings' },
        { label: t.stripWishlist, to: 'wishlist' },
      ],
    },
  ]

  return (
    <div className="lg:hidden">
      {rows.map((row) => (
        <nav
          className={`grid w-full grid-cols-2 ${row.className}`}
          key={row.className}
        >
          {row.items.map((item, itemIndex) => {
            const className = `flex h-9 items-center justify-center text-sm font-medium ${
              itemIndex === 0 ? 'border-r border-black/15' : ''
            }`
            if (item.to === 'rankings') {
              return (
                <Link className={className} key={item.label} params={{ locale: lang }} search={{ board: 'popular' }} to="/$locale/rankings">
                  {item.label}
                </Link>
              )
            }
            if (item.to === 'wishlist') {
              return (
                <Link className={className} key={item.label} params={{ locale: lang }} to="/$locale/wishlist">
                  {item.label}
                </Link>
              )
            }
            return (
              <Link
                className={className}
                key={item.label}
                params={{ collectionId: item.collectionId ?? '', locale: lang }}
                to="/$locale/platform/$collectionId"
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      ))}
    </div>
  )
}

// Daily random pick bar: one tap into the /random route (ucg999's
// daily-random module, minus the coin economy we did not adopt).
export function DailyRandomBar({ lang }: { lang: Locale }) {
  const t = copy[lang]

  return (
    <section className="bg-base-100">
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <Link
          className="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200 px-4 py-3 shadow-sm transition hover:border-primary/40"
          params={{ locale: lang }}
          to="/$locale/random"
        >
          <span className="flex items-center gap-2 font-semibold text-base-content">
            <i className="ri-shuffle-line text-lg text-primary" />
            {t.randomTitle}
          </span>
          <span className="btn btn-primary btn-sm">{t.randomCta}</span>
        </Link>
      </div>
    </section>
  )
}
