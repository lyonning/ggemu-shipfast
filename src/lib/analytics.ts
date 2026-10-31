import { siteConfig } from './site-config'

export type GameAnalyticsEvent =
  | 'game_detail_view'
  | 'game_play_click'
  | 'game_runtime_loaded'
  | 'game_start_error'
  | 'game_play_retry'
  | 'game_fullscreen_toggle'

type EventParams = {
  game_id?: string
  locale?: string
  player_type?: 'game' | 'live' | 'rom'
  error_reason?: 'load_timeout' | 'fullscreen_unavailable'
  retry_count?: number
  fullscreen?: boolean
}

type Gtag = (...args: unknown[]) => void

declare global {
  interface Window {
    gtag?: Gtag
  }
}

// The GA4 script must be configured and loaded before an event is sent.
// Never report iframe load as game_start_success: cross-origin load != game startup.
export function trackGameEvent(eventName: GameAnalyticsEvent, params: EventParams = {}) {
  if (typeof window === 'undefined' || !siteConfig.GOOGLE_ANALYTICS_ID.trim()) return
  if (typeof window.gtag !== 'function') return

  window.gtag('event', eventName, {
    ...params,
    transport_type: 'beacon',
  })
}
