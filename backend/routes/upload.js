const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { authenticate } = require('../middleware/auth');
const crypto = require('crypto');
const path = require('path');
const sharp = require('sharp');

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const BUCKET     = process.env.R2_BUCKET || 'tvettrack';
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

const ALLOWED_IMAGE = /^image\/(jpeg|png|gif|webp|bmp|tiff)$/;
const ALLOWED_PDF   = /^application\/pdf$/;
const ALLOWED       = /^(image\/(jpeg|png|gif|webp|bmp|tiff)|application\/pdf)$/;

// A4 at 150 dpi — enough for clear print, reasonable file size
const A4_W = 1240;  // 210 mm × 150 dpi / 25.4
const A4_H = 1754;  // 297 mm × 150 dpi / 25.4
const INNER_W = Math.round(A4_W * 0.92); // 92% — ~8mm margin each side
const INNER_H = Math.round(A4_H * 0.92);

// Blank-page detection. Mean brightness is a poor proxy: a normal scanned page
// is overwhelmingly white paper, so sparse text averages well above any usable
// threshold and legitimate documents get rejected. Measure how much ink is on
// the page instead — anything below this fraction of dark pixels is blank.
const INK_DARK_LEVEL    = 200;    // 0-255; below this counts as ink
const MIN_INK_FRACTION  = 0.0008; // 0.08% of pixels — a stray speck won't pass

// Longest edge for overlay assets (signature / stamp)
const ASSET_MAX = 1200;

/**
 * True only when the page carries essentially no ink.
 *
 * Downsamples to a small greyscale bitmap and counts dark pixels. Flattening
 * onto white first matters twice over: it keeps transparent regions from being
 * read as ink, and it drops the alpha channel that would otherwise skew the
 * measurement. Errs strongly towards keeping the upload — wrongly rejecting a
 * real document is far worse than storing a blank one.
 */
async function isBlankPage(inputBuffer) {
  try {
    const { data } = await sharp(inputBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .greyscale()
      .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (!data.length) return false;
    let dark = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < INK_DARK_LEVEL) dark++;
    }
    return (dark / data.length) < MIN_INK_FRACTION;
  } catch {
    return false; // if we can't tell, keep the upload
  }
}

/**
 * Normalise a letterhead: full-bleed, exactly A4.
 *
 * A letterhead is a page background, so it must NOT be trimmed and re-padded
 * to 92% like a scanned document — that bakes a ~4% white margin into all four
 * edges and no amount of CSS can recover it. Stretch straight to A4 instead so
 * the stored file already matches the page it will be painted onto.
 */
async function normaliseLetterhead(inputBuffer) {
  const output = await sharp(inputBuffer)
    .rotate()
    .resize(A4_W, A4_H, { fit: 'fill' })   // exact A4, no margins, no letterboxing
    // JPEG has no alpha channel; without an explicit flatten sharp drops it and
    // every transparent pixel lands on black instead of the page white.
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 92, progressive: true, mozjpeg: true })
    .toBuffer();

  return { buffer: output, mime: 'image/jpeg', ext: '.jpg' };
}

/**
 * Normalise an overlay asset (signature / stamp).
 *
 * These are composited on top of a letter, so — unlike a scanned page — they
 * must keep their alpha channel and must NOT be padded onto an A4 canvas.
 * Encoding them as JPEG would drop the alpha and flatten every transparent
 * pixel to black, which is what produced solid-black signatures/stamps.
 */
async function normaliseAsset(inputBuffer) {
  let trimmed;
  try {
    // trims the transparent / uniform border around the ink
    trimmed = await sharp(inputBuffer).rotate().trim().toBuffer();
  } catch {
    trimmed = await sharp(inputBuffer).rotate().toBuffer();
  }

  const output = await sharp(trimmed)
    .resize(ASSET_MAX, ASSET_MAX, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { buffer: output, mime: 'image/png', ext: '.png' };
}

/**
 * Normalise a scanned image:
 *  1. Auto-rotate from EXIF orientation
 *  2. Trim scanner borders / white margins (corner-colour matching)
 *  3. Detect blank pages
 *  4. Scale to fit 92% of A4 (aspect-ratio preserved)
 *  5. Centre on white A4 canvas
 * Returns { buffer, mime } or null when blank.
 */
async function normaliseImage(inputBuffer) {
  // ── 1 & 2: rotate + trim ────────────────────────────────────────────────────
  let trimmed;
  try {
    const { data } = await sharp(inputBuffer)
      .rotate()                        // honour EXIF orientation
      .trim({ threshold: 28 })         // remove border matching corner colour
      .toBuffer({ resolveWithObject: true });
    trimmed = data;
  } catch {
    // trim can fail on fully-solid images; fall back to just rotating
    trimmed = await sharp(inputBuffer).rotate().toBuffer();
  }

  // ── 3: blank detection ──────────────────────────────────────────────────────
  if (await isBlankPage(trimmed)) return null;

  // ── 4: scale to fit inner A4 area ───────────────────────────────────────────
  const { data: resized, info } = await sharp(trimmed)
    .resize(INNER_W, INNER_H, { fit: 'inside', withoutEnlargement: false })
    .toBuffer({ resolveWithObject: true });

  // ── 5: centre on white A4 canvas ────────────────────────────────────────────
  const padTop  = Math.round((A4_H - info.height) / 2);
  const padLeft = Math.round((A4_W - info.width)  / 2);

  const output = await sharp(resized)
    .extend({
      top:    padTop,
      bottom: A4_H - info.height - padTop,
      left:   padLeft,
      right:  A4_W - info.width  - padLeft,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    // extend() only whitens the padding — flatten covers transparent pixels
    // inside the image itself, which JPEG would otherwise render black.
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 92, progressive: true, mozjpeg: true })
    .toBuffer();

  return { buffer: output, mime: 'image/jpeg', ext: '.jpg' };
}

module.exports = async function uploadRoutes(fastify) {
  fastify.register(require('@fastify/multipart'), {
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  fastify.addHook('preHandler', authenticate);

  fastify.post('/', async (request, reply) => {
    if (!ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID) {
      return reply.code(503).send({ error: 'R2 not configured' });
    }

    const data = await request.file();
    if (!data) return reply.code(400).send({ error: 'No file uploaded' });

    const originalMime = data.mimetype;
    if (!ALLOWED.test(originalMime)) {
      return reply.code(400).send({ error: 'Only images and PDFs are allowed' });
    }

    const rawBuf = await data.toBuffer();

    // ── Process images; pass PDFs through unchanged ──────────────────────────
    let uploadBuf, uploadMime, ext;

    if (ALLOWED_IMAGE.test(originalMime)) {
      // `kind` lets the client say what the image is for; scanned documents are
      // the default. An image with genuinely transparent pixels is always an
      // overlay asset regardless of `kind` — `isOpaque` checks real pixels, so
      // an opaque PNG scan still goes down the document path.
      const kind = String(request.query?.kind || 'document');

      let isOpaque = true;
      try { ({ isOpaque } = await sharp(rawBuf).stats()); } catch {}

      let result;
      if (kind === 'letterhead')            result = await normaliseLetterhead(rawBuf);
      else if (kind === 'asset' || !isOpaque) result = await normaliseAsset(rawBuf);
      else                                   result = await normaliseImage(rawBuf);

      if (!result) {
        return reply.code(422).send({ error: 'blank_page', message: 'This page appears to be blank and was not uploaded.' });
      }
      uploadBuf  = result.buffer;
      uploadMime = result.mime;
      ext        = result.ext;
    } else {
      // PDF — store as-is; layout normalisation happens in the letter renderer
      uploadBuf  = rawBuf;
      uploadMime = 'application/pdf';
      ext        = path.extname(data.filename).toLowerCase() || '.pdf';
    }

    const key = `uploads/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        uploadBuf,
      ContentType: uploadMime,
    }));

    const url = `${(PUBLIC_URL || '').replace(/\/$/, '')}/${key}`;
    return { url, key };
  });
};
