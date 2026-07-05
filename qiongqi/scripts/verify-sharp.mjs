// Runtime smoke test for the `sharp` native binding, mirroring verify-sqlite.mjs.
// Invoked from desktop/scripts/verify-package-resources.mjs to confirm the
// deployed runtime can actually decode/encode images before electron-builder
// packages it. Run from a directory whose node_modules contains sharp.
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(join(process.cwd(), 'package.json'))

let sharp
try {
  sharp = require('sharp')
} catch (error) {
  throw new Error(`sharp native module failed to load: ${error?.message ?? error}`)
}

// Decode a tiny solid-color PNG, resize and re-encode as webp. This exercises
// the full native pipeline (libvips decode → resize → webp encode) that
// @qiongqi/attachments relies on for auto text-fallback generation.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)
const webp = await sharp(png).resize(2, 2).webp().toBuffer()

if (webp.subarray(0, 4).toString('ascii') !== 'RIFF' || webp.subarray(8, 12).toString('ascii') !== 'WEBP') {
  throw new Error('sharp produced an invalid webp buffer; native binding is misconfigured')
}

console.log(`sharp native binding ok; encoded ${webp.length}-byte webp`)
