import { useEffect, useRef, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { trackGameEvent } from '#/lib/analytics'

type LoadingState = 'loading' | 'frame-loaded' | 'timeout'
type PlayerCopy = {
  loading: string
  frameLoaded: string
  timeout: string
  retry: string
  fullscreen: string
  exitFullscreen: string
  fullscreenUnsupported: string
}

const copy: Record<Locale, PlayerCopy> = {
  'zh-CN': {
    loading: '正在连接游戏…',
    frameLoaded: '播放器页面已加载。若游戏仍未启动，请检查网络或点击重试。',
    timeout: '播放器响应时间较长，游戏可能尚未启动。',
    retry: '重新加载',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    fullscreenUnsupported: '当前浏览器不支持此处全屏，可尝试横屏或使用浏览器全屏模式。',
  },
  en: {
    loading: 'Connecting to the game…',
    frameLoaded: 'Player page loaded. If the game has not started, check your connection or retry.',
    timeout: 'The player is taking longer than expected. The game may not have started.',
    retry: 'Reload player',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    fullscreenUnsupported: 'Fullscreen is not available here. Try landscape orientation or your browser’s fullscreen mode.',
  },
  ja: {
    loading: 'ゲームに接続しています…',
    frameLoaded: 'プレイヤーページを読み込みました。ゲームが始まらない場合は再読み込みしてください。',
    timeout: '読み込みに時間がかかっています。ゲームがまだ開始されていない可能性があります。',
    retry: '再読み込み',
    fullscreen: '全画面',
    exitFullscreen: '全画面を終了',
    fullscreenUnsupported: '全画面表示に対応していません。横画面またはブラウザの全画面表示をお試しください。',
  },
}

const PLAYER_LOAD_TIMEOUT_MS = 25_000

type Props = {
  src: string
  title: string
  locale: Locale
  allow?: string
  className?: string
  gameId?: string
  playerType?: 'game' | 'live' | 'rom'
}

export function EmbeddedGamePlayer({
  src,
  title,
  locale,
  allow = 'autoplay; gamepad; fullscreen',
  className = '',
  gameId,
  playerType = 'game',
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<LoadingState>('loading')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState(false)
  const t = copy[locale]
  const eventParams = { game_id: gameId, locale, player_type: playerType }

  useEffect(() => {
    setStatus('loading')
    const timeout = window.setTimeout(() => {
      setStatus((current) => current === 'loading' ? 'timeout' : current)
    }, PLAYER_LOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [attempt, src, gameId, locale, playerType])

  useEffect(() => {
    if (status === 'timeout') {
      trackGameEvent('game_start_error', {
        game_id: gameId,
        locale,
        player_type: playerType,
        error_reason: 'load_timeout',
      })
    }
  }, [status, gameId, locale, playerType])

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === shellRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function toggleFullscreen() {
    setFullscreenError(false)
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        trackGameEvent('game_fullscreen_toggle', { ...eventParams, fullscreen: false })
      } else if (shellRef.current?.requestFullscreen) {
        await shellRef.current.requestFullscreen()
        trackGameEvent('game_fullscreen_toggle', { ...eventParams, fullscreen: true })
      } else {
        setFullscreenError(true)
        trackGameEvent('game_start_error', { ...eventParams, error_reason: 'fullscreen_unavailable' })
      }
    } catch {
      setFullscreenError(true)
      trackGameEvent('game_start_error', { ...eventParams, error_reason: 'fullscreen_unavailable' })
    }
  }

  function retry() {
    trackGameEvent('game_play_retry', { ...eventParams, retry_count: attempt + 1 })
    setStatus('loading')
    setAttempt((current) => current + 1)
  }

  return (
    <div
      className={`relative isolate min-h-0 w-full overflow-hidden bg-black text-white ${className}`}
      ref={shellRef}
    >
      <iframe
        key={`${src}:${attempt}`}
        allow={allow}
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0 bg-black"
        onLoad={() => {
          setStatus('frame-loaded')
          trackGameEvent('game_runtime_loaded', eventParams)
        }}
        src={src}
        title={title}
      />
      {status === 'loading' ? (
        <div
          aria-live="polite"
          className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/90 p-6 text-center"
          role="status"
        >
          <div>
            <span className="loading loading-spinner loading-lg" aria-hidden="true" />
            <p className="mt-4 text-sm">{t.loading}</p>
          </div>
        </div>
      ) : null}
      {status === 'timeout' ? (
        <div
          aria-live="polite"
          className="absolute inset-0 z-10 grid place-items-center bg-black/90 p-6 text-center"
          role="alert"
        >
          <div className="max-w-sm">
            <p className="text-sm">{t.timeout}</p>
            <button className="btn btn-primary mt-4" onClick={retry} type="button">
              {t.retry}
            </button>
          </div>
        </div>
      ) : null}
      <div className="absolute right-2 top-2 z-20 flex gap-2">
        <button
          aria-label={t.retry}
          className="btn btn-sm border border-white/30 bg-black/75 text-white hover:bg-black"
          onClick={retry}
          type="button"
        >
          <i className="ri-refresh-line" aria-hidden="true" />
          <span className="hidden sm:inline">{t.retry}</span>
        </button>
        <button
          aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen}
          className="btn btn-sm border border-white/30 bg-black/75 text-white hover:bg-black"
          onClick={toggleFullscreen}
          type="button"
        >
          <i className={isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} aria-hidden="true" />
          <span className="hidden sm:inline">{isFullscreen ? t.exitFullscreen : t.fullscreen}</span>
        </button>
      </div>
      {fullscreenError ? (
        <p className="absolute bottom-3 left-3 right-3 z-20 rounded bg-black/90 p-2 text-center text-xs" role="status">
          {t.fullscreenUnsupported}
        </p>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {status === 'frame-loaded' ? t.frameLoaded : ''}
      </span>
    </div>
  )
}
