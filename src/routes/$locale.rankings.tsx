import { Link, createFileRoute } from '@tanstack/react-router'

import { SiteLayout } from '#/components/site-layout'
import { SimpleGameCard, formatPlays } from '#/components/simple-game-card'
import {
  getRankingsPageData,
  type Locale,
  type RankingBoard,
} from '#/lib/ggemu'
import { normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'

type RankingsSearch = {
  board?: RankingBoard
}

function normalizeBoard(value: unknown): RankingBoard {
  return value === 'rising' || value === 'latest' ? value : 'popular'
}

const copy: Record<
  Locale,
  {
    title: string
    description: string
    boards: Record<RankingBoard, string>
    risingNote: string
    gainSuffix: string
  }
> = {
  'zh-CN': {
    title: '游戏排行榜',
    description:
      '大家都在玩什么，一张榜看全：历史最热、人气飙升和最新入库的经典游戏排行。',
    boards: { latest: '最新入库', popular: '历史最热', rising: '人气飙升' },
    risingNote: '按最近几天的游玩增量排名，数据每日更新。',
    gainSuffix: '次新增游玩',
  },
  en: {
    title: 'Game Rankings',
    description:
      'What everyone is playing, on one board: all-time hits, fast risers and the newest additions.',
    boards: { latest: 'Newest', popular: 'All-time Popular', rising: 'Rising Fast' },
    risingNote: 'Ranked by plays gained over the last few days. Updated daily.',
    gainSuffix: 'new plays',
  },
  ja: {
    title: 'ゲームランキング',
    description:
      'みんなが遊んでいるゲームを一枚に：歴代人気、急上昇、新着のランキング。',
    boards: { latest: '新着', popular: '歴代人気', rising: '急上昇' },
    risingNote: 'ここ数日のプレイ増加数でランキング。毎日更新。',
    gainSuffix: '新規プレイ',
  },
}

export const Route = createFileRoute('/$locale/rankings')({
  validateSearch: (search: Record<string, unknown>): RankingsSearch => ({
    board: normalizeBoard(search.board),
  }),
  loaderDeps: ({ search }) => ({ board: normalizeBoard(search.board) }),
  loader: async ({ deps, params }) => {
    const [seoOrigin, data] = await Promise.all([
      getSeoOrigin(),
      getRankingsPageData({ data: { board: deps.board } }),
    ])

    return { ...data, locale: normalizeLocale(params.locale), seoOrigin }
  },
  head: ({ loaderData, params }) => {
    const locale = normalizeLocale(params.locale)
    const t = copy[locale]

    return {
      links: loaderData?.seoOrigin
        ? getLocalizedSeoLinks({
            locale,
            origin: loaderData.seoOrigin,
            path: '/rankings',
          })
        : undefined,
      meta: [
        { title: `${t.title} | RetroPlay SEA` },
        { name: 'description', content: t.description },
      ],
    }
  },
  component: RankingsPage,
})

const BOARD_ORDER: Array<RankingBoard> = ['popular', 'rising', 'latest']

function RankingsPage() {
  const data = Route.useLoaderData()
  const { locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const t = copy[lang]
  const board = data.board

  return (
    <SiteLayout locale={lang}>
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-base-content">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/70">
          {t.description}
        </p>

        <div className="tabs tabs-box mt-5 w-fit" role="tablist">
          {BOARD_ORDER.map((item) => (
            <Link
              aria-selected={item === board}
              className={`tab ${item === board ? 'tab-active' : ''}`}
              key={item}
              params={{ locale: lang }}
              role="tab"
              search={item === 'popular' ? {} : { board: item }}
              to="/$locale/rankings"
            >
              {t.boards[item]}
            </Link>
          ))}
        </div>

        {board === 'rising' ? (
          <p className="mt-3 text-xs text-base-content/55">{t.risingNote}</p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data.entries.map((entry, index) => (
            <SimpleGameCard
              game={entry.game}
              key={entry.game._id ?? entry.game.url_slug ?? index}
              lang={lang}
              rank={index + 1}
              subline={
                board === 'rising' && typeof entry.gain === 'number'
                  ? `+${entry.gain.toLocaleString(lang)} ${t.gainSuffix}`
                  : formatPlays(entry.game.plays_count, lang)
              }
            />
          ))}
        </div>
      </section>
    </SiteLayout>
  )
}
