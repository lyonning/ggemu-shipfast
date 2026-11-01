# RetroPlay SEA — Batch Game Rights Review (Phase 2)

This pipeline inventories GGEMU's **currently accessible online, non-GCoin** game catalog and prepares evidence-review records for every returned game. The previously observed **1,749** games is not hard-coded: compare the report's upstream count with your original list. Metadata is **not** evidence of ownership or permission. No game is automatically approved.

## 1. Generate a review report from GitHub

1. Open **GitHub → Actions → Game rights audit and publication gate** in `feature/phase1-launch`.
2. Select **Run workflow**, with branch `feature/phase1-launch`.
3. Once finished, download the **game-rights-review-report** artifact.
4. Open `reports/game-rights/review-report.csv` in Excel or Google Sheets. It contains one row per unique returned game:
   - game_id, game_name, platform, developer, upstream_url;
   - rights_holder, license_basis, evidence_url;
   - risk_class, license_status, commercial_use, third_party_embed, public_play, territory_confirmed, assets_confirmed;
   - approved_by, approved_at, expires_at, publish_allowed, notes.
5. `reports/game-rights/summary.json` shows the count of each category; `inventory.json` contains the fetched metadata and source counts.

Alternatively, with Node.js 22 or newer:

```sh
node scripts/game-rights-audit.mjs inventory
node scripts/game-rights-audit.mjs report
node scripts/game-rights-audit.mjs validate
```

API source: `https://ggemu.com/api/games/search` using `play_online=1`, `is_gcoin_game=0`, and paginated requests. The inventory is restricted to the upstream API's returned subset, **not all games that ever existed**. The command retries transient failures and fails if an upstream page is missing or the returned count is less than the reported total. If the API refuses access or has changed, the workflow will fail rather than invent rows.

## 2. Review evidence **per game**

Edit `config/game-rights-reviews.json`. Empty array `[]` means **everything is unverified**. The reviewer may add an entry following this template (the example is **NOT an approved game**):

```json
[
  {
    "game_id": "EXACT_ID_OR_SLUG_FROM_INVENTORY",
    "status": "unknown",
    "rights_holder": "",
    "license_basis": "",
    "evidence_url": "",
    "commercial_use": false,
    "third_party_embed": false,
    "public_play": false,
    "territory_confirmed": false,
    "assets_confirmed": false,
    "approved_by": "",
    "approved_at": "",
    "expires_at": "",
    "notes": "Locate official rights-holder confirmation before publishing."
  }
]
```

Four risk/status classes:
- **A_verified / approved**: manually reviewed, rights holder identified, and source evidence explicitly covers third-party public playback, commercial uses, target territories and game assets, with a named reviewer and approval date.
- **B_unverified / unknown**: no verified evidence; **not** a claim of infringement.
- **C_missing_permission / needs_permission**: known restriction or incomplete permission; do not publish.
- **D_do_not_publish / prohibited**: refusal, prohibition or incompatible terms; do not publish.

`developer` is merely an upstream metadata hint, **not** proof that the developer controls distribution rights. Likewise, open-source emulator licenses do not license commercial ROMs, images, soundtracks or trademarks.

## 3. Human-controlled publishing (two independent controls)

Only **after** evidence is reviewed, someone with authority must:
1. Set the exact `game_id` in `config/game-rights-reviews.json` to `"status":"approved"`.
2. Fill **all** proof fields and set **all five** boolean scopes (`commercial_use`, `third_party_embed`, `public_play`, `territory_confirmed`, `assets_confirmed`) to `true`.
3. Record `rights_holder`, `license_basis`, an HTTPS `evidence_url`, nonempty `approved_by`, `approved_at` in YYYY-MM-DD, and valid optional `expires_at`.
4. Add the **same exact ID/slug** to `config/approved-games.json` in a separate, reviewed commit.
5. Run `node scripts/game-rights-audit.mjs validate` and inspect GitHub Actions **publication-gate**.

**The report and workflow never update the live approved game list.** The application checks both the whitelist entry **and** the signed review with current expiry at runtime, so a whitelist ID alone cannot publish a game. These are technical checks; a false or fraudulent human assertion is not independently verified by the software.

Protect `config/approved-games.json` and `config/game-rights-reviews.json` using GitHub branch protection / CODEOWNERS and require a human reviewer before merging into a production-deployed branch. Cloudflare deployment must not bypass that review. The action does not configure repository protection.

## 4. Results and limits

The CSV shows `publish_allowed=YES` only if the **review evidence metadata and declarations are complete**; it is a technical eligibility result, not legal advice or independently verified licensing. An approved review record does **not** itself publish the game until the whitelist includes the ID.

Evidence should link to an authoritative, durable document or rights-holder approval; store private contracts securely and use an access-controlled evidence reference rather than placing private contract text in the public repository.

Manual run produces report artifacts in Actions; no auto-scheduling or auto-updating the repository is enabled. Do not commit an unreviewed catalog into the public site or automatically approve anything.

**Current state:** No approved games and no signed review records by default, so all inventory rows will be B_unverified and publish_allowed=NO until explicitly reviewed.
