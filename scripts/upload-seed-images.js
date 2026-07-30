/**
 * Bulk upload seed images to Cloudinary
 *
 * Usage:
 *   node scripts/upload-seed-images.js
 *
 * Requires env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * Auto-loads from apps/api/.env or apps/.env.staging
 *
 * Outputs: docs/seed-images/cloudinary-urls.json
 */

const cloudinary = require('cloudinary').v2
const fs = require('fs')
const path = require('path')

// ── Load env from file (no dotenv dependency) ─────
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false
  const content = fs.readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
  console.log(`  Loaded env from: ${filePath}`)
  return true
}

const envPaths = [
  path.resolve(__dirname, '../apps/api/.env'),
  path.resolve(__dirname, '../apps/.env.staging'),
  path.resolve(__dirname, '../.env'),
]
for (const p of envPaths) {
  if (loadEnvFile(p)) break
}

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env
if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('ERROR: Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET')
  console.error('Set them in apps/api/.env or as environment variables')
  process.exit(1)
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
})

// ── Config ────────────────────────────────────────
const IMAGES_DIR = path.resolve(__dirname, '../docs/seed-images')
const OUTPUT_FILE = path.resolve(IMAGES_DIR, 'cloudinary-urls.json')
const CONCURRENCY = 3

function getFolder(filename) {
  if (filename.startsWith('dest-')) return 'seed/destinations'
  return 'seed/trips'
}

function getPublicId(filename) {
  const folder = getFolder(filename)
  const name = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '')
  return `${folder}/${name}`
}

// ── Upload function ───────────────────────────────
async function uploadImage(filePath) {
  const filename = path.basename(filePath)
  const publicId = getPublicId(filename)

  const result = await cloudinary.uploader.upload(filePath, {
    public_id: publicId,
    overwrite: true,
    resource_type: 'image',
    transformation: [
      { width: 1200, height: 800, crop: 'fill', gravity: 'auto', quality: 'auto', fetch_format: 'auto' },
    ],
  })

  return {
    filename,
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
  }
}

// ── Batch runner ──────────────────────────────────
async function uploadBatch(files, batchSize) {
  const results = {}
  const details = []
  let uploaded = 0
  const total = files.length

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        try {
          const result = await uploadImage(file)
          uploaded++
          console.log(`  [${uploaded}/${total}] ✓ ${result.filename} → ${result.url} (${Math.round(result.bytes / 1024)}KB)`)
          return result
        } catch (err) {
          uploaded++
          const filename = path.basename(file)
          console.error(`  [${uploaded}/${total}] ✗ ${filename} — ${err.message || err}`)
          return null
        }
      })
    )

    for (const r of batchResults) {
      if (r) {
        results[r.filename] = r.url
        details.push(r)
      }
    }
  }

  return { results, details }
}

// ── Main ──────────────────────────────────────────
async function main() {
  console.log('\n═══════════════════════════════════════════')
  console.log('  Cloudinary Bulk Upload — Seed Images')
  console.log(`  Cloud: ${CLOUDINARY_CLOUD_NAME}`)
  console.log('═══════════════════════════════════════════\n')

  const allFiles = fs.readdirSync(IMAGES_DIR)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .sort()
    .map((f) => path.join(IMAGES_DIR, f))

  console.log(`Found ${allFiles.length} images to upload\n`)

  if (allFiles.length === 0) {
    console.log('No images found. Exiting.')
    return
  }

  const { results, details } = await uploadBatch(allFiles, CONCURRENCY)

  const output = {
    _generated: new Date().toISOString(),
    _cloud: CLOUDINARY_CLOUD_NAME,
    _count: Object.keys(results).length,
    _totalSizeKB: Math.round(details.reduce((sum, d) => sum + d.bytes, 0) / 1024),
    urls: results,
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2))

  console.log(`\n═══════════════════════════════════════════`)
  console.log(`  Done! ${output._count}/${allFiles.length} uploaded`)
  console.log(`  Total size: ${output._totalSizeKB}KB`)
  console.log(`  Output: ${OUTPUT_FILE}`)
  console.log(`═══════════════════════════════════════════\n`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
