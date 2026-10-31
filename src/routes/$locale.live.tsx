import {
  Link,
  Outlet,
  createFileRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import { EmbeddedGamePlayer } from '#/components/embedded-game-player'
import {
  searchLiveRooms,
  type Locale,
  type PublicLiveRoom,
} from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'
import { siteConfig } from '#/lib/site-config'
import { useCurrentSiteTheme } from '#/lib/use-site-theme'

const LIVE_ROOM_PAGE_SIZE = 24
const LIVE_ROOM_REFRESH_INTERVAL = 10_000

type LiveRoomSearch = {
  page?: number
}

function normalizeSearchPage(value: unknown) {
  const page = Number(value)

  return Number.isInteger(page) && page > 0 ? page : 1
}

function validateLiveRoomSearch(
  search: Record<string, unknown>,
): LiveRoomSearch {
  const page = normalizeSearchPage(search.page)

  return page > 1 ? { page } : {}
}

export const Route = createFileRoute('/$locale/live')({
  validateSearch: validateLiveRoomSearch,
  loaderDeps: ({ search }) => ({
    page: normalizeSearchPage(search.page),
  }),
  loader: async ({ deps: { page } }) => {
    const [seoOrigin, result] = await Promise.all([
      getSeoOrigin(),
      searchLiveRooms({
        data: {
          limit: LIVE_ROOM_PAGE_SIZE,
          page,
        },
      }),
    ])

    return {
      ...result,
      seoOrigin,
    }
  },
  head: ({ loaderData, params }) => {
    const locale = normalizeLocale(params.locale)
    const t = getI18n(locale).live

    return {
      links: loaderData?.seoOrigin
        ? getLocalizedSeoLinks({
            locale,
            origin: loaderData.seoOrigin,
            path: '/live',
          })
        : undefined,
      meta: [
        { title: t.title },
        { name: 'description', content: t.description },
      ],
    }
  },
  errorComponent: LiveRoomError,
  component: LiveRoomListPage,
})

function LiveRoomListPage() {
  const initialResult = Route.useLoaderData()
  const runSearch = useServerFn(searchLiveRooms)
  const { locale } = Route.useParams()
  const { page = 1 } = Route.useSearch()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const lang = normalizeLocale(locale)
  const t = getI18n(lang).live
  const [result, setResult] = useState(initialResult)
  const [activeRoom, setActiveRoom] = useState<PublicLiveRoom | null>(null)
  const { rooms, pagination } = result
  const pages = Math.max(pagination.pages, 1)

  useEffect(() => {
    setResult(initialResult)
  }, [initialResult])

  useEffect(() => {
    let isDisposed = false
    let isRequesting = false

    async function refreshRooms() {
      if (isRequesting) {
        return
      }

      isRequesting = true

      try {
        const nextResult = await runSearch({
          data: {
            limit: LIVE_ROOM_PAGE_SIZE,
            page,
          },
        })

        if (!isDisposed) {
          setResult((current) => ({ ...current, ...nextResult }))
        }
      } catch {
        // Keep the last successful result.
      } finally {
        isRequesting = false
      }
    }

    const intervalId = window.setInterval(
      refreshRooms,
      LIVE_ROOM_REFRESH_INTERVAL,
    )

    return () => {
      isDisposed = true
      window.clearInterval(intervalId)
    }
  }, [page, runSearch])

  if (pathname !== `/${locale}/live`) {
    return <Outlet />
  }

  return (
    <SiteLayout locale={lang}>
      <section className="border-b border-base-300 bg-base-100">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-error">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error" />
            </span>
            {t.eyebrow}
          </div>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-base-content/70">
            {t.subtitle}
          </p>
          <p className="mt-4 text-sm font-medium text-base-content/55">
            {t.total.replace('{total}', String(pagination.total))}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {rooms.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rooms.map((room) => (
              <LiveRoomCard
                key={room.roomId}
                lang={lang}
                onOpen={setActiveRoom}
                room={room}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-box border border-base-300 bg-base-100 p-10 text-center">
            <i className="ri-live-line text-4xl text-base-content/35" />
            <p className="mt-3 text-base-content/65">{t.empty}</p>
          </div>
        )}

        {pages > 1 ? (
          <nav
            aria-label={t.page
              .replace('{page}', String(pagination.page))
              .replace('{pages}', String(pages))}
            className="mt-10 flex items-center justify-center gap-4"
          >
            {pagination.page > 1 ? (
              <Link
                className="btn btn-outline btn-sm"
                params={{ locale: lang }}
                search={
                  pagination.page > 2 ? { page: pagination.page - 1 } : {}
                }
                to="/$locale/live"
              >
                <i className="ri-arrow-left-line" />
                {t.previous}
              </Link>
            ) : (
              <span className="btn btn-outline btn-sm btn-disabled">
                <i className="ri-arrow-left-line" />
                {t.previous}
              </span>
            )}

            <span className="text-sm text-base-content/60">
              {t.page
                .replace('{page}', String(pagination.page))
                .replace('{pages}', String(pages))}
            </span>

            {pagination.page < pages ? (
              <Link
                className="btn btn-outline btn-sm"
                params={{ locale: lang }}
                search={{ page: pagination.page + 1 }}
                to="/$locale/live"
              >
                {t.next}
                <i className="ri-arrow-right-line" />
              </Link>
            ) : (
              <span className="btn btn-outline btn-sm btn-disabled">
                {t.next}
                <i className="ri-arrow-right-line" />
              </span>
            )}
          </nav>
        ) : null}
      </section>

      {activeRoom ? (
        <LiveRoomPlayerModal
          lang={lang}
          onClose={() => setActiveRoom(null)}
          room={activeRoom}
        />
      ) : null}
    </SiteLayout>
  )
}

function LiveRoomCard({
  lang,
  onOpen,
  room,
}: {
  lang: Locale
  onOpen: (room: PublicLiveRoom) => void
  room: PublicLiveRoom
}) {
  const t = getI18n(lang).live

  return (
    <button
      aria-label={`${t.watchLive}: ${room.game.name}`}
      className="group w-full overflow-hidden rounded-box border border-base-300 bg-base-100 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-error/40 hover:shadow-lg"
      onClick={() => onOpen(room)}
      type="button"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-base-300">
        <img
          alt={room.game.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
          src={room.game.game_cover}
        />
        <span className="badge badge-error absolute left-3 top-3 gap-1 font-semibold text-error-content">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          LIVE
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-lg font-semibold leading-snug">
              {room.game.name}
            </h2>
            <p className="mt-2 text-sm text-base-content/55">
              {room.game.platform}
            </p>
          </div>
          <i className="ri-arrow-right-up-line shrink-0 text-xl text-base-content/35 transition group-hover:text-error" />
        </div>

      </div>
    </button>
  )
}

function LiveRoomPlayerModal({
  lang,
  onClose,
  room,
}: {
  lang: Locale
  onClose: () => void
  room: PublicLiveRoom
}) {
  const t = getI18n(lang).live
  const theme = useCurrentSiteTheme()
  const embedSrc = buildLiveRoomEmbedUrl(lang, room.roomId, theme)
  const gameId = room.game.url_slug || room.game._id

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus()
      }
    }
  }, [])

  return (
    <div
      aria-label={`${t.watchLive}: ${room.game.name}`}
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-2 backdrop-blur-sm sm:p-6 lg:p-10"
      role="dialog"
    >
      <section className="flex h-full max-h-[900px] w-full max-w-[1500px] flex-col overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-2xl sm:rounded-xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-base-300 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error" />
            </span>
            <h2 className="min-w-0 truncate font-semibold">{room.game.name}</h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              className="btn btn-primary btn-xs shrink-0 sm:btn-sm"
              params={{ gameId, locale: lang }}
              to="/$locale/games/$gameId"
            >
              <i className="ri-play-fill" />
              Play Game
            </Link>

            <button
              aria-label={t.closePlayer}
              className="btn btn-circle btn-ghost btn-sm shrink-0"
              onClick={onClose}
              title={t.closePlayer}
              type="button"
            >
              <i className="ri-close-line text-xl" />
            </button>
          </div>
        </header>

        <EmbeddedGamePlayer
          className="min-h-0 flex-1"
          locale={lang}
          src={embedSrc}
          title={room.game.name}
        />
      </section>
    </div>
  )
}

function buildLiveRoomEmbedUrl(locale: Locale, roomId: string, theme: string) {
  const params = new URLSearchParams({
    embed: '1',
    r: siteConfig.GGEMU_REFCODE,
    theme,
  })

  return `https://ggemu.com/${locale}/playing/${encodeURIComponent(roomId)}?${params}`
}

function LiveRoomError() {
  const router = useRouter()
  const { locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const t = getI18n(lang).live

  return (
    <SiteLayout locale={lang}>
      <section className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <i className="ri-signal-wifi-error-line text-5xl text-error" />
        <p className="mx-auto mt-4 max-w-lg text-base-content/70">{t.error}</p>
        <button
          className="btn btn-primary mt-6"
          onClick={() => router.invalidate()}
          type="button"
        >
          <i className="ri-refresh-line" />
          {t.retry}
        </button>
      </section>
    </SiteLayout>
  )
}
