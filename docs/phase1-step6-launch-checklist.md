# Phase 1 — Step 6: SEO and security launch acceptance

Production origin: https://retro.1231533.com
Branch: feature/phase1-launch

## Automated source changes

- Canonical URL and hreflang source pinned to the production origin instead of request Host headers.
- robots.txt references the production sitemap and discourages crawling game launch, random, live and ROM player pages. Robots rules do not restrict actual access.
- sitemap.xml uses only explicitly approved games; it does not scan unrelated upstream game pages.
- Sitemap generation cache shortened to 1 hour, including CDN caching.
- Root response security headers configured: X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy.
- Removed an unrelated external game iframe in the maintenance/error screen to keep game distribution aligned with the approved game policy.
- Default site metadata now reflects the RetroPlay SEA brand and the fact that game publication requires approval.

## Production verification — do not mark passed without checking

1. Cloudflare build for the new commit must succeed.
2. GET https://retro.1231533.com/robots.txt should return 200, production sitemap URL and the specified crawl exclusions.
3. GET https://retro.1231533.com/sitemap.xml should return 200 XML; every game URL must correspond to an entry in config/approved-games.json. Validate that <loc> and hreflang URLs use only the production host.
4. Inspect response headers on /en and /zh-CN and verify X-Content-Type-Options: nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy. Root route headers might need deployment-platform rules for asset and special-route coverage.
5. Check canonical, hreflang, title, description and og:image for /en and /zh-CN. Confirm that preview deployment domains do not appear in SEO outputs.
6. Confirm blocked /en/games/<unapproved-id> and /en/games/<unapproved-id>/play do not expose a player.
7. Test iframe fullscreen and PSP isolation in real browsers; do not introduce an untested strict Content-Security-Policy that could break third-party embeds.
8. Confirm GA4 Realtime continues receiving page_view and custom events, and that ads scripts are not loaded on the game play route.
9. In Google Search Console, verify ownership of https://retro.1231533.com and submit /sitemap.xml. Search indexing is not automatic; review coverage after submission.
10. Check Cloudflare TLS, redirect from HTTP to HTTPS, asset cache policy, error response codes, and site performance.

## Remaining launch caveats

- An empty game whitelist is intentional: no games should be published until rights verification is complete.
- A robots.txt exclusion is advisory and does not secure private URLs.
- Security headers on application responses do not necessarily cover Cloudflare static assets.
- No automatic build, live fetch, header audit, or Search Console submission is implied by a GitHub commit.
