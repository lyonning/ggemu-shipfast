// Build 480px-wide cover thumbnails for the assets site:
//   retroplay-assets/covers/{id}.jpg -> retroplay-assets/covers-480/{id}.jpg
// List/card contexts load the thumb (mobile data saver); detail pages and
// the hero keep the full-size cover. Idempotent: existing thumbs are
// skipped, so the daily sync can call the same logic for new covers.
//
// Usage: node scripts/build-cover-thumbs.mjs [assetsDir]
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const assetsDir =
  process.argv[2] ?? path.join(homedir(), 'workspace/retroplay-assets')
const coversDir = path.join(assetsDir, 'covers')
const thumbsDir = path.join(assetsDir, 'covers-480')
mkdirSync(thumbsDir, { recursive: true })

function makeThumb(src, dest) {
  // Never upscale: width is min(480, source width).
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      src,
      '-vf',
      "scale='min(480,iw)':-1",
      '-q:v',
      '4',
      dest,
    ],
    { encoding: 'utf-8' },
  )
  return result.status === 0 && existsSync(dest)
}

const files = readdirSync(coversDir).filter((name) => name.endsWith('.jpg'))
let made = 0
let skipped = 0
let failed = 0
let bytes = 0
for (const name of files) {
  const dest = path.join(thumbsDir, name)
  if (existsSync(dest)) {
    skipped += 1
    continue
  }
  if (makeThumb(path.join(coversDir, name), dest)) {
    made += 1
    bytes += statSync(dest).size
  } else {
    failed += 1
    console.error(`FAILED: ${name}`)
  }
}
console.log(
  `thumbs: ${made} made, ${skipped} skipped, ${failed} failed, ${(bytes / 1024 / 1024).toFixed(1)} MB new`,
)
if (failed > 0) process.exit(1)
