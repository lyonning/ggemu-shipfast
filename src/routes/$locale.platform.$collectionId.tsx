import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import { SimpleGameCard, formatPlays } from '#/components/simple-game-card'
import {
  PLATFORM_COLLECTIONS,
  THEME_COLLECTIONS,
  FC_CARTRIDGES_COPY,
  FC_CARTRIDGES_ID,
  getCollectionDef,
} from '#/lib/collections'
import {
  getCartridgesPageData,
  getCollectionPageData,
  type CartridgeEntry,
  type Locale,
} from '#/lib/ggemu'
import { normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'

const uiCopy: Record<
  Locale,
  {
    gamesCount: string
    collected: string
    collect: string
    collectedAction: string
    numberSuffix: string
    notFound: string
    browseTitle: string
  }
> = {
  'zh-CN': {
    gamesCount: '款游戏',
    collected: '已收藏',
    collect: '收藏',
    collectedAction: '已收藏',
    numberSuffix: '号',
    notFound: '这个合集不存在。',
    browseTitle: '更多合集',
  },
  en: {
    gamesCount: 'games',
    collected: 'Collected',
    collect: 'Collect',
    collectedAction: 'Collected',
    numberSuffix: '',
    notFound: 'This collection does not exist.',
    browseTitle: 'More collections',
  },
  ja: {
    gamesCount: '本',
    collected: 'コレクション済み',
    collect: '集める',
    collectedAction: '収集中',
    numberSuffix: '番',
    notFound: 'このコレクションは存在しません。',
    browseTitle: '他のコレクション',
  },
}

export const Route = createFileRoute('/$locale/platform/$collectionId')({
  loader: async ({ params }) => {
    const seoOrigin = await getSeoOrigin()

    if (params.collectionId === FC_CARTRIDGES_ID) {
      const data = await getCartridgesPageData()
      return { cartridges: data, collection: null, seoOrigin }
    }

    const def = getCollectionDef(params.collectionId)
    if (!def) {
      return { cartridges: null, collection: null, seoOrigin }
    }

    const data = await getCollectionPageData({
      data: { collectionId: params.collectionId },
    })

    return {
      cartridges: null,
      collection: data ? { ...data, def } : null,
      seoOrigin,
    }
  },
  head: ({ loaderData, params }) => {
    const locale = normalizeLocale(params.locale)
    const isCartridges = params.collectionId === FC_CARTRIDGES_ID
    const def = isCartridges ? null : getCollectionDef(params.collectionId)
    const title = isCartridges
      ? FC_CARTRIDGES_COPY.title[locale]
      : def?.title[locale]
    const description = isCartridges
      ? FC_CARTRIDGES_COPY.intro[locale]
      : def?.intro[locale]

    if (!title) return {}

    return {
      links: loaderData?.seoOrigin
        ? getLocalizedSeoLinks({
            locale,
            origin: loaderData.seoOrigin,
            path: `/platform/${params.collectionId}`,
          })
        : undefined,
      meta: [
        { title: `${title} | RetroPlay SEA` },
        { name: 'description', content: description ?? '' },
      ],
    }
  },
  component: CollectionPage,
})

function CollectionPage() {
  const data = Route.useLoaderData()
  const { collectionId, locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const t = uiCopy[lang]

  if (data.cartridges) {
    return (
      <SiteLayout locale={lang}>
        <CartridgesView entries={data.cartridges.entries} lang={lang} />
        <CollectionLinks currentId={collectionId} lang={lang} />
      </SiteLayout>
    )
  }

  if (!data.collection) {
    return (
      <SiteLayout locale={lang}>
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="text-base-content/70">{t.notFound}</p>
        </section>
      </SiteLayout>
    )
  }

  const { def, games, total } = data.collection

  return (
    <SiteLayout locale={lang}>
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-base-content">
          {def.title[lang]}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/70">
          {def.intro[lang]}
        </p>
        <p className="mt-2 text-xs text-base-content/55">
          {total} {t.gamesCount}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {games.map((game) => (
            <SimpleGameCard
              game={game}
              key={game._id ?? game.url_slug}
              lang={lang}
              subline={formatPlays(game.plays_count, lang)}
            />
          ))}
        </div>
      </section>
      <CollectionLinks currentId={collectionId} lang={lang} />
    </SiteLayout>
  )
}

const COLLECTION_STORAGE_KEY = 'retroplay-fc-collection'

function CartridgesView({
  entries,
  lang,
}: {
  entries: Array<CartridgeEntry>
  lang: Locale
}) {
  const t = uiCopy[lang]
  const [collected, setCollected] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLECTION_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) {
        setCollected(new Set(parsed.filter((x) => typeof x === 'string')))
      }
    } catch {
      // Start with an empty collection.
    }
  }, [])

  function toggle(approvedId: string) {
    setCollected((current) => {
      const next = new Set(current)
      if (next.has(approvedId)) {
        next.delete(approvedId)
      } else {
        next.add(approvedId)
      }
      try {
        window.localStorage.setItem(
          COLLECTION_STORAGE_KEY,
          JSON.stringify([...next]),
        )
      } catch {
        // Storage unavailable; keep the in-memory state only.
      }
      return next
    })
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold text-base-content">
        {FC_CARTRIDGES_COPY.title[lang]}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/70">
        {FC_CARTRIDGES_COPY.intro[lang]}
      </p>
      <p className="mt-2 text-xs text-base-content/55">
        {entries.length} {t.gamesCount} · {t.collected} {collected.size}{' '}
        {t.gamesCount}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {entries.map((entry) => {
          const gameId = entry.game.url_slug || entry.game._id || ''
          const approvedId =
            entry.game.url_slug || entry.game._id || String(entry.number)
          const isCollected = collected.has(approvedId)

          return (
            <div
              className="card card-compact group relative h-full overflow-hidden border border-amber-300/60 bg-gradient-to-b from-amber-50 to-base-100 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:from-amber-950/40"
              key={approvedId}
            >
              <Link
                params={{ gameId, locale: lang }}
                search={{}}
                to="/$locale/games/$gameId"
              >
                <figure className="relative aspect-[4/3] bg-base-300">
                  {entry.game.game_cover ? (
                    <img
                      alt={entry.game.name ?? 'Game cover'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      src={entry.game.game_cover}
                    />
                  ) : null}
                  <span className="absolute left-2 top-2 rounded bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-amber-950 shadow">
                    {String(entry.number).padStart(3, '0')}
                    {t.numberSuffix}
                  </span>
                </figure>
                <div className="card-body gap-1 p-3">
                  <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">
                    {entry.game.name}
                  </h3>
                  <p className="truncate text-xs text-base-content/55">
                    {[entry.year, entry.developer, entry.tag]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </Link>
              <button
                className={`btn btn-xs absolute bottom-3 right-3 shadow ${
                  isCollected ? 'btn-warning' : 'btn-outline'
                }`}
                onClick={() => toggle(approvedId)}
                type="button"
              >
                {isCollected ? t.collectedAction : t.collect}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CollectionLinks({
  currentId,
  lang,
}: {
  currentId: string
  lang: Locale
}) {
  const t = uiCopy[lang]
  const all = [
    ...PLATFORM_COLLECTIONS,
    ...THEME_COLLECTIONS,
    {
      id: FC_CARTRIDGES_ID,
      kind: 'theme' as const,
      title: FC_CARTRIDGES_COPY.title,
      intro: FC_CARTRIDGES_COPY.intro,
    },
  ].filter((collection) => collection.id !== currentId)

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <h2 className="text-lg font-semibold text-base-content">
        {t.browseTitle}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {all.map((collection) => (
          <Link
            className="btn btn-sm btn-outline"
            key={collection.id}
            params={{ collectionId: collection.id, locale: lang }}
            to="/$locale/platform/$collectionId"
          >
            {collection.title[lang]}
          </Link>
        ))}
      </div>
    </section>
  )
}
