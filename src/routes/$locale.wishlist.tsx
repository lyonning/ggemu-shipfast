import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import { PLATFORM_COLLECTIONS } from '#/lib/collections'
import type { Locale } from '#/lib/ggemu'
import { normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'
import { addWish, getWishes, type Wish } from '#/lib/wishlist'

const copy: Record<
  Locale,
  {
    title: string
    description: string
    formTitle: string
    nameLabel: string
    namePlaceholder: string
    platformLabel: string
    platformAny: string
    categoryLabel: string
    categoryPlaceholder: string
    eraLabel: string
    eraPlaceholder: string
    submit: string
    submitting: string
    thanks: string
    failed: string
    listTitle: string
    wishesUnit: string
    empty: string
  }
> = {
  'zh-CN': {
    title: '游戏愿望单',
    description:
      '告诉我们你想玩的游戏，我们会优先去找并上线——想要的人越多，优先级越高。',
    formTitle: '提交愿望',
    nameLabel: '游戏名',
    namePlaceholder: '比如：吞食天地2 中文版',
    platformLabel: '什么平台',
    platformAny: '不确定 / 其他',
    categoryLabel: '类型',
    categoryPlaceholder: '比如：角色扮演、格斗、策略…',
    eraLabel: '年代',
    eraPlaceholder: '比如：1994、90 年代…',
    submit: '提交愿望',
    submitting: '提交中…',
    thanks: '收到！已经记到愿望单上了。',
    failed: '提交失败，请稍后再试。',
    listTitle: '大家的游戏愿望',
    wishesUnit: '个愿望',
    empty: '还没有人许愿，来做第一个吧。',
  },
  en: {
    title: 'Game Wishlist',
    description:
      'Tell us which game you want to play — we hunt it down and add it, most-wanted first.',
    formTitle: 'Make a wish',
    nameLabel: 'Game name',
    namePlaceholder: 'e.g. Chrono Trigger (Chinese version)',
    platformLabel: 'Platform',
    platformAny: 'Not sure / other',
    categoryLabel: 'Genre',
    categoryPlaceholder: 'e.g. RPG, fighting, strategy…',
    eraLabel: 'Era',
    eraPlaceholder: 'e.g. 1994, the 90s…',
    submit: 'Submit wish',
    submitting: 'Submitting…',
    thanks: 'Got it! Your wish is on the list.',
    failed: 'Submission failed, please try again later.',
    listTitle: "Everyone's wishes",
    wishesUnit: 'wishes',
    empty: 'No wishes yet — be the first.',
  },
  ja: {
    title: 'ゲームリクエスト',
    description:
      '遊びたいゲームを教えてください。探して追加します——リクエストが多いものから優先します。',
    formTitle: 'リクエストする',
    nameLabel: 'ゲーム名',
    namePlaceholder: '例：天地を喰らう2',
    platformLabel: 'プラットフォーム',
    platformAny: '不明 / その他',
    categoryLabel: 'ジャンル',
    categoryPlaceholder: '例：RPG、格闘、戦略…',
    eraLabel: '年代',
    eraPlaceholder: '例：1994、90年代…',
    submit: '送信',
    submitting: '送信中…',
    thanks: '受け付けました！リストに追加されました。',
    failed: '送信に失敗しました。後でもう一度お試しください。',
    listTitle: 'みんなのリクエスト',
    wishesUnit: '件',
    empty: 'まだリクエストがありません。最初の一人になりましょう。',
  },
}

export const Route = createFileRoute('/$locale/wishlist')({
  loader: async ({ params }) => {
    const [seoOrigin, data] = await Promise.all([
      getSeoOrigin(),
      getWishes(),
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
            path: '/wishlist',
          })
        : undefined,
      meta: [
        { title: `${t.title} | RetroPlay SEA` },
        { name: 'description', content: t.description },
      ],
    }
  },
  component: WishlistPage,
})

function WishlistPage() {
  const initial = Route.useLoaderData()
  const { locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const t = copy[lang]
  const submitWish = useServerFn(addWish)
  const [wishes, setWishes] = useState<Array<Wish>>(initial.wishes)
  const [total, setTotal] = useState(initial.total)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>(
    'idle',
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setStatus('sending')

    try {
      const result = await submitWish({
        data: {
          category: String(formData.get('category') ?? ''),
          era: String(formData.get('era') ?? ''),
          name: String(formData.get('name') ?? ''),
          platform: String(formData.get('platform') ?? ''),
          website: String(formData.get('website') ?? ''),
        },
      })

      if (result.ok) {
        if (result.wish) {
          setWishes((current) => [result.wish!, ...current])
          setTotal((current) => current + 1)
        }
        form.reset()
        setStatus('done')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  const inputClass =
    'input input-bordered w-full bg-base-100 text-base-content'

  return (
    <SiteLayout locale={lang}>
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-base-content">{t.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-base-content/70">
          {t.description}
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
          <form
            className="flex h-fit flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm"
            onSubmit={handleSubmit}
          >
            <h2 className="text-lg font-semibold">{t.formTitle}</h2>
            <label className="flex flex-col gap-1 text-sm">
              {t.nameLabel} *
              <input
                className={inputClass}
                maxLength={60}
                name="name"
                placeholder={t.namePlaceholder}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.platformLabel}
              <select className="select select-bordered w-full" name="platform">
                <option value="">{t.platformAny}</option>
                {PLATFORM_COLLECTIONS.map((collection) => (
                  <option key={collection.id} value={collection.platformName}>
                    {collection.platformName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.categoryLabel}
              <input
                className={inputClass}
                maxLength={40}
                name="category"
                placeholder={t.categoryPlaceholder}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.eraLabel}
              <input
                className={inputClass}
                maxLength={20}
                name="era"
                placeholder={t.eraPlaceholder}
              />
            </label>
            {/* Honeypot: hidden from people, tempting to bots. */}
            <input
              aria-hidden="true"
              className="hidden"
              name="website"
              tabIndex={-1}
            />
            <button
              className="btn btn-primary mt-1"
              disabled={status === 'sending'}
              type="submit"
            >
              {status === 'sending' ? t.submitting : t.submit}
            </button>
            {status === 'done' ? (
              <p className="text-sm text-success">{t.thanks}</p>
            ) : null}
            {status === 'error' ? (
              <p className="text-sm text-error">{t.failed}</p>
            ) : null}
          </form>

          <div>
            <h2 className="text-lg font-semibold">
              {t.listTitle} · {total} {t.wishesUnit}
            </h2>
            {wishes.length === 0 ? (
              <p className="mt-3 text-sm text-base-content/60">{t.empty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-base-300 rounded-box border border-base-300 bg-base-100">
                {wishes.map((wish) => (
                  <li className="flex flex-col gap-0.5 px-4 py-3" key={wish.id}>
                    <span className="font-medium text-base-content">
                      {wish.name}
                    </span>
                    <span className="text-xs text-base-content/55">
                      {[wish.platform, wish.category, wish.era]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  )
}
