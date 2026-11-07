import { useEffect, useRef, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { trackGameEvent } from '#/lib/analytics'

declare global {
  interface Window {
    EJS_player?: string
    EJS_core?: string
    EJS_gameUrl?: string
    EJS_gameName?: string
    EJS_ready?: () => void
    EJS_onGameStart?: () => void
    // EmulatorJS 4.2.x's loader reads the all-lowercase EJS_pathtodata;
    // set both spellings or the runtime files resolve to wrong paths.
    EJS_pathtodata?: string
    EJS_pathToData?: string
    EJS_startOnLoaded?: boolean
    EJS_language?: string
    EJS_backgroundColor?: string
    EJS_emulator?: { destroy?: () => void }
  }
}

// Self-hosted EmulatorJS runtime (public/emu-data), served from our own
// site; ROM files come from our R2 bucket (roms.1231533.com).
const DATA_PATH = '/emu-data/'

type PlayerCopy = {
  loading: string
  tapHint: string
  errorTitle: string
  errorBody: string
  retry: string
  fullscreen: string
  exitFullscreen: string
  switchToEmbed: string
}

const copy: Record<Locale, PlayerCopy> = {
  'zh-CN': {
    loading: '正在加载本地模拟器…',
    tapHint: '加载完成后，点一下画面开始游戏',
    errorTitle: '本地模拟器加载失败',
    errorBody: '模拟器文件没能加载出来，多半是网络中断。可以重试，或切换到 GGEMU 播放器。',
    retry: '重新加载',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    switchToEmbed: '用 GGEMU 播放器',
  },
  en: {
    loading: 'Loading the local emulator…',
    tapHint: 'When loading finishes, tap the screen to start',
    errorTitle: 'Local emulator failed to load',
    errorBody: 'The emulator files could not be loaded, most likely a network issue. Retry, or switch to the GGEMU player.',
    retry: 'Reload player',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    switchToEmbed: 'Use GGEMU player',
  },
  ja: {
    loading: 'ローカルエミュレータを読み込み中…',
    tapHint: '読み込みが終わったら、画面をタップして開始',
    errorTitle: 'ローカルエミュレータの読み込みに失敗しました',
    errorBody: 'エミュレータファイルを読み込めませんでした。ネットワークの問題の可能性があります。再試行するか、GGEMU プレイヤーに切り替えてください。',
    retry: '再読み込み',
    fullscreen: '全画面',
    exitFullscreen: '全画面を終了',
    switchToEmbed: 'GGEMU プレイヤーを使う',
  },
}

type Props = {
  romUrl: string
  core: string
  gameName: string
  locale: Locale
  gameId?: string
  className?: string
  onSwitchToEmbed: () => void
}

export function LocalGamePlayer({
  romUrl,
  core,
  gameName,
  locale,
  gameId,
  className = '',
  onSwitchToEmbed,
}: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [showTapHint, setShowTapHint] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const t = copy[locale]
  const eventParams = { game_id: gameId, locale, player_type: 'game' as const, player: 'local' }

  useEffect(() => {
    setStatus('loading')
    setShowTapHint(false)
    window.EJS_player = '#local-game'
    window.EJS_core = core
    window.EJS_gameUrl = romUrl
    window.EJS_gameName = gameName
    window.EJS_pathtodata = DATA_PATH
    window.EJS_pathToData = DATA_PATH
    window.EJS_startOnLoaded = true
    window.EJS_language = locale === 'zh-CN' ? 'zh-CN' : 'en-US'
    window.EJS_backgroundColor = '#000000'
    // EmulatorJS fires "ready" when its start screen is up and "start"
    // when emulation actually begins. Encrypted arcade ROMs can sit on
    // a black screen between the two (decryption + core init), and the
    // start screen itself waits for a tap when autoplay is blocked —
    // show our own hint for that gap so the black screen explains
    // itself. The hint never intercepts the tap (pointer-events-none).
    window.EJS_ready = () => setShowTapHint(true)
    window.EJS_onGameStart = () => setShowTapHint(false)

    const script = document.createElement('script')
    script.src = `${DATA_PATH}loader.js`
    script.async = true
    script.onload = () => {
      setStatus('ready')
      trackGameEvent('game_runtime_loaded', eventParams)
    }
    script.onerror = () => {
      setStatus('error')
      trackGameEvent('game_start_error', { ...eventParams, error_reason: 'emulator_load_failed' })
    }
    document.body.appendChild(script)

    return () => {
      try {
        window.EJS_emulator?.destroy?.()
      } catch {
        // ignore cleanup errors
      }
      script.remove()
      delete window.EJS_gameUrl
      delete window.EJS_core
      delete window.EJS_ready
      delete window.EJS_onGameStart
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [romUrl, core, gameName, attempt])

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === shellRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        trackGameEvent('game_fullscreen_toggle', { ...eventParams, fullscreen: false })
      } else if (shellRef.current?.requestFullscreen) {
        await shellRef.current.requestFullscreen()
        trackGameEvent('game_fullscreen_toggle', { ...eventParams, fullscreen: true })
      }
    } catch {
      // EmulatorJS has its own fullscreen button as a fallback.
    }
  }

  function retry() {
    trackGameEvent('game_play_retry', { ...eventParams, retry_count: attempt + 1 })
    setAttempt((current) => current + 1)
  }

  return (
    <div
      className={`relative isolate min-h-0 w-full overflow-hidden bg-black text-white ${className}`}
      onPointerDown={() => setShowTapHint(false)}
      ref={shellRef}
    >
      <div id="local-game" className="absolute inset-0 h-full w-full" />
      {showTapHint && status !== 'error' ? (
        <p className="pointer-events-none absolute bottom-16 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-3 py-1.5 text-xs text-white/85">
          {t.tapHint}
        </p>
      ) : null}
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
      {status === 'error' ? (
        <div
          aria-live="polite"
          className="absolute inset-0 z-10 grid place-items-center bg-black/90 p-6 text-center"
          role="alert"
        >
          <div className="max-w-sm">
            <p className="font-semibold text-red-400">{t.errorTitle}</p>
            <p className="mt-2 text-sm text-white/70">{t.errorBody}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button className="btn btn-primary" onClick={retry} type="button">
                {t.retry}
              </button>
              <button className="btn btn-ghost border border-white/30" onClick={onSwitchToEmbed} type="button">
                {t.switchToEmbed}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="absolute right-2 top-2 z-20 flex gap-2">
        <button
          aria-label={t.switchToEmbed}
          className="btn btn-sm border border-white/30 bg-black/75 text-white hover:bg-black"
          onClick={onSwitchToEmbed}
          type="button"
        >
          <i className="ri-swap-box-line" aria-hidden="true" />
          <span className="hidden sm:inline">{t.switchToEmbed}</span>
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
    </div>
  )
}
