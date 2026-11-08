import type { ReactNode } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'

import { ThirdPartyScripts } from '#/components/third-party-scripts'
import { getDocumentLang, getSeoOrigin } from '#/lib/seo'
import { serializeSiteConfig, siteConfig } from '#/lib/site-config'
import { getSiteThemeInitScript } from '#/lib/site-themes'
import appCss from '../styles.css?url'

const defaultSocialImagePath = '/og.png'

function getDefaultSocialImage(origin?: string) {
  return origin ? `${origin}${defaultSocialImagePath}` : defaultSocialImagePath
}

function getPwaInstallInitScript() {
  return `
    window.__GGEMU_INSTALL_PROMPT__=null;
    window.addEventListener('beforeinstallprompt',function(event){
      event.preventDefault();
      window.__GGEMU_INSTALL_PROMPT__=event;
      window.dispatchEvent(new Event('ggemu:installprompt'));
    });
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js').catch(function(){});
    }
  `
}

export const Route = createRootRoute({
  headers: () => ({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  }),
  loader: () => getSeoOrigin(),
  head: ({ loaderData }) => {
    const defaultSocialImage = getDefaultSocialImage(loaderData)

    return {
      meta: [
        {
          charSet: 'utf-8',
        },
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
        },
        {
          title: `${siteConfig.SITE_NAME} | ${siteConfig.SITE_SLOGAN}`,
        },
        {
          name: 'description',
          content:
            'Discover RetroPlay SEA, explore gaming guides, and play approved browser games when available.',
        },
        {
          name: 'keywords',
          content:
            'retro games online, play GBA games online, NES games online, SNES games online, PS1 games online, N64 games online, Sega Genesis games, arcade games online, browser emulator games, no download games',
        },
        {
          property: 'og:title',
          content: siteConfig.SITE_SLOGAN,
        },
        {
          property: 'og:site_name',
          content: siteConfig.SITE_NAME,
        },
        {
          property: 'og:description',
          content:
            'Explore RetroPlay SEA gaming guides and approved browser games.',
        },
        {
          property: 'og:type',
          content: 'website',
        },
        {
          property: 'og:image',
          content: defaultSocialImage,
        },
        {
          property: 'og:image:type',
          content: 'image/png',
        },
        {
          property: 'og:image:width',
          content: '1731',
        },
        {
          property: 'og:image:height',
          content: '909',
        },
        {
          property: 'og:image:alt',
          content: siteConfig.SITE_SLOGAN,
        },
        {
          name: 'twitter:card',
          content: 'summary_large_image',
        },
        {
          name: 'twitter:title',
          content: siteConfig.SITE_SLOGAN,
        },
        {
          name: 'twitter:description',
          content:
            'Explore RetroPlay SEA gaming guides and approved browser games.',
        },
        {
          name: 'twitter:image',
          content: defaultSocialImage,
        },
        {
          name: 'twitter:image:alt',
          content: siteConfig.SITE_SLOGAN,
        },
      ],
      links: [
        {
          rel: 'stylesheet',
          href: appCss,
        },
        {
          rel: 'icon',
          href: '/logo.png',
          type: 'image/png',
        },
        {
          rel: 'apple-touch-icon',
          href: '/logo.png',
        },
        {
          rel: 'manifest',
          href: '/manifest.webmanifest',
        },
      ],
    }
  },
  component: RootComponent,
  errorComponent: MaintenanceErrorComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  return <Outlet />
}

function MaintenanceErrorComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const locale = getDocumentLang(pathname)
  const messages = getMaintenanceMessages(locale)

  return (
    <main className="min-h-screen bg-base-100 px-4 py-16 text-base-content sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center text-center">
        <img
          alt={siteConfig.SITE_NAME}
          className="h-20 w-20 rounded-2xl object-contain"
          src="/logo.png"
        />
        <h1 className="mt-5 text-3xl font-semibold leading-tight sm:text-4xl">
          {siteConfig.SITE_NAME}
        </h1>
        <p className="mt-2 max-w-full truncate text-base font-medium text-primary">
          {siteConfig.SITE_SLOGAN}
        </p>
        <h2 className="mt-8 text-2xl font-semibold leading-tight sm:text-3xl">
          {messages.title}
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-base-content/70">
          {messages.description}
        </p>
      </section>
    </main>
  )
}

function getMaintenanceMessages(locale: string) {
  if (locale === 'en') {
    return {
      title: 'The server is under maintenance',
      description: 'Scheduled maintenance is in progress. We will be back online shortly.',
    }
  }

  if (locale === 'ja') {
    return {
      title: 'サーバーは現在メンテナンス中です',
      description: '予定されたメンテナンスを実施しています。まもなく再開します。',
    }
  }

  return {
    title: '当前服务器正在维护',
    description: '我们正在进行计划维护，很快就会恢复访问。',
  }
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <html lang={getDocumentLang(pathname)}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: getSiteThemeInitScript(),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: getPwaInstallInitScript(),
          }}
        />
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__SITE_CONFIG__=${serializeSiteConfig()}`,
          }}
        />
        <ThirdPartyScripts pathname={pathname} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
