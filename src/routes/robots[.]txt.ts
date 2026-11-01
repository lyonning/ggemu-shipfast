import { createFileRoute } from '@tanstack/react-router'
import { PRODUCTION_SITE_ORIGIN } from '#/lib/seo'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        return new Response(buildRobotsTxt(PRODUCTION_SITE_ORIGIN), {
          headers: {
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })
      },
    },
  },
})

function buildRobotsTxt(origin: string) {
  return `User-agent: *
Disallow: /*/games/*/play
Disallow: /*/random
Disallow: /*/play-my-rom
Disallow: /*/live
Sitemap: ${origin}/sitemap.xml
`
}
