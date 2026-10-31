# Approved game publication policy

RetroPlay SEA publishes **only games explicitly listed** in `config/approved-games.json`.

## Default behavior

The list intentionally starts empty (`[]`). This fails closed: the site's game catalog, game detail and play routes, related games, random game selection, live-game links, recently played tiles, and game sitemap entries should not publish unapproved games. Other sections (blog, deals and Play My ROM) are separate features and are not licensed by this list.

## Approving games

1. Verify that the rights holder permits this particular website to publicly embed, display and distribute the relevant game experience. A game being available elsewhere or tagged as "free" is not sufficient evidence.
2. Record the license, authorization URL, approver, date and expiry in `docs/game-license-register.csv`.
3. Add the exact upstream `url_slug` (preferred) or `_id` to `config/approved-games.json`:
   ```json
   ["verified-game-slug", "another-verified-game-slug"]
   ```
4. Use the *same* ID/slug found in the page URL for direct game and play links; if both an `_id` and a slug are used in your URLs, list both after rights verification.
5. Deploy and verify homepage, search, locale game detail, /play, /random, /live, recently played, and /sitemap.xml on https://retro.1231533.com.

Removing an ID immediately revokes access from this site once the deployment and caches have updated. The upstream GGEMU service is outside this site's control; this policy **does not** remove content from GGEMU itself, and it does not independently establish legal permission.

Do not approve games merely because the site can embed them. If the catalog is empty, showing zero games is expected and safe.
