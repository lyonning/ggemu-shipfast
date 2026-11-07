import {
  HomeHeroCarousel,
  HomeRails,
  LiveNowStrip,
} from './home-rails'
import {
  GamesSection,
  HomeFaqSection,
  HomeLatestBlogPostsSection,
  SearchForm,
} from './shared'
import { RecentPlayedGamesSection } from './recent-played-games'
import type { HomeTemplateProps } from './types'

export function DefaultHomeTemplate(props: HomeTemplateProps) {
  const { filters, homeRails, lang, latestBlogPosts, t } = props
  // While the visitor is searching or filtering, the result grid belongs
  // directly under the search form. In the default browse layout it sits
  // below the rails, which made search results look like "not found".
  const filtersActive = Boolean(
    filters.query.trim() || filters.platform || filters.category,
  )

  const gamesSection = (
    <GamesSection
      {...props}
      gridClassName="grid gap-4 sm:grid-cols-3 lg:grid-cols-5"
      sectionClassName="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8"
      showHeader={false}
    />
  )

  return (
    <>
      {homeRails ? <HomeHeroCarousel games={homeRails.hero} lang={lang} /> : null}
      <LiveNowStrip lang={lang} />
      <RecentPlayedGamesSection lang={lang} />

      <section className="bg-base-100">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold leading-tight text-base-content sm:text-5xl">
              {t.title}
            </h1>
            <p className="mt-3 text-base leading-7 text-base-content/70 sm:text-lg">
              {t.subtitle}
            </p>
          </div>

          <SearchForm {...props} mode="default" />
        </div>
      </section>

      {filtersActive ? gamesSection : null}

      {homeRails ? <HomeRails lang={lang} rails={homeRails} /> : null}

      {filtersActive ? null : gamesSection}

      <HomeLatestBlogPostsSection blogPosts={latestBlogPosts} lang={lang} />
      <HomeFaqSection lang={lang} />
    </>
  )
}
