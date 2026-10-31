# GA4 event tracking — RetroPlay SEA

## Setup

The existing GA4 loader reads `GOOGLE_ANALYTICS_ID` from Cloudflare environment variables (if present), otherwise `siteconfig.js`. Currently the file value is empty, so tracking remains disabled until a valid GA4 Measurement ID (`G-...`) is configured. For Cloudflare, set the environment variable and redeploy. Never insert an API secret.

## Events

| Event | Trigger | Important caveat |
| --- | --- | --- |
| `game_detail_view` | Client renders a permitted game detail page | Excludes nested /play route |
| `game_play_click` | Clicks Play on a permitted game detail page | Does not imply playback succeeded |
| `game_runtime_loaded` | Cross-origin iframe fires `load` | This means the iframe document loaded, **NOT** game startup |
| `game_start_error` | Player iframe has not loaded within 25s or fullscreen unavailable | Distinguish `error_reason`: `load_timeout` vs `fullscreen_unavailable`; not a confirmed upstream game error |
| `game_play_retry` | User clicks reload | `retry_count` identifies attempt number |
| `game_fullscreen_toggle` | Browser fullscreen request succeeds | Includes `fullscreen` boolean |

Event parameters may include `game_id`, `locale`, `player_type` (`game`, `live`, `rom`), `error_reason`, `retry_count`, and `fullscreen`. No ROM file content, raw iframe URL, names, or email addresses are sent by this module.

**Do not emit `game_start_success` until the GGEMU upstream iframe has a verified `postMessage` protocol for real game startup.**

## Verification

1. Confirm the Cloudflare deployment commit and that GA4 ID is configured for the deployed environment.
2. Open https://retro.1231533.com with consent to analytics if applicable. Check that `gtag.js` loads and GA4 DebugView receives events.
3. Add a **licensed and explicitly approved** game to `config/approved-games.json` before testing game detail/play. The list starts empty, so these routes are currently intentionally unavailable.
4. Visit an approved game detail: expect `game_detail_view`; click Play: `game_play_click`.
5. Wait for player iframe load: `game_runtime_loaded`. Retry: `game_play_retry`. Toggle fullscreen: `game_fullscreen_toggle`. Force a delayed response to test `game_start_error` with `load_timeout`.
6. Check the Live / Play My ROM player separately; note these provide different `player_type` values.

No GA4 real-time events can be proven by a successful Cloudflare build alone.
