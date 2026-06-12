// routes/documents.js — institute client documents
// Stores files in Cloudflare R2 when configured, falls back to PostgreSQL base64
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter } = require('../middleware/auth');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const BUCKET     = process.env.CLOUDFLARE_R2_BUCKET_NAME || '';
const PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');
const R2_ENABLED = !!(ACCOUNT_ID && BUCKET &&
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);

const R2 = R2_ENABLED ? new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
}) : null;

const ensureTable = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS institute_documents (
    id SERIAL PRIMARY KEY,
    institute_id INTEGER NOT NULL,
    client_id INTEGER,
    client_name TEXT,
    file_name TEXT NOT NULL,
    file_key TEXT NOT NULL,
    file_size INTEGER,
    content_type TEXT,
    file_data TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID
  )`);
  await pool.query(`ALTER TABLE institute_documents ADD COLUMN IF NOT EXISTS file_data TEXT`).catch(() => {});
  // Fix client_id column type if it was created as UUID
  await pool.query(`ALTER TABLE institute_documents ALTER COLUMN client_id TYPE INTEGER USING NULL`).catch(() => {});
};

async function getDownloadUrl(doc) {
  if (R2_ENABLED) {
    if (PUBLIC_URL) return `${PUBLIC_URL}/${doc.file_key}`;
    return getSignedUrl(R2, new GetObjectCommand({ Bucket: BUCKET, Key: doc.file_key }), { expiresIn: 3600 }).catch(() => null);
  }
  return `/api/documents/${doc.id}/download`;
}

router.use(authenticate);

// List documents
router.get('/', async (req, res, next) => {
  try {
    await ensureTable();
    const { institute_id, client_id } = req.query;
    if (!institute_id) return res.status(400).json({ error: 'institute_id required' });
    let q = 'SELECT id,institute_id,client_id,client_name,file_name,file_key,file_size,content_type,uploaded_at,uploaded_by FROM institute_documents WHERE institute_id=$1';
    const params = [institute_id];
    if (client_id) { params.push(client_id); q += ` AND client_id=$${params.length}`; }
    q += ' ORDER BY uploaded_at DESC';
    const { rows } = await pool.query(q, params);
    const docs = await Promise.all(rows.map(async doc => ({ ...doc, url: await getDownloadUrl(doc) })));
    res.json(docs);
  } catch(e) { next(e); }
});

// Download from DB (fallback when R2 not configured)
router.get('/:id/download', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT file_name,content_type,file_data FROM institute_documents WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const doc = rows[0];
    if (!doc.file_data) return res.status(404).json({ error: 'No file data stored' });
    const buf = Buffer.from(doc.file_data, 'base64');
    res.set('Content-Type', doc.content_type || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${doc.file_name}"`);
    res.send(buf);
  } catch(e) { next(e); }
});

// Upload document — backend receives base64 and uploads to R2 (or stores in DB)
router.post('/', requireWriter, async (req, res, next) => {
  try {
    await ensureTable();
    const { institute_id, client_id, client_name, file_name, file_size, content_type, file_data } = req.body;
    if (!institute_id || !file_name || !file_data) return res.status(400).json({ error: 'institute_id, file_name, file_data required' });

    const ext = (file_name.split('.').pop() || 'bin').toLowerCase();
    const key = `institutes/${institute_id}/${client_id || 'general'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    let stored_key = key;
    let stored_data = null;

    if (R2_ENABLED) {
      const buf = Buffer.from(file_data, 'base64');
      await R2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buf,
        ContentType: content_type || 'application/octet-stream',
      }));
    } else {
      stored_key = `db/${key}`;
      stored_data = file_data;
    }

    const { rows } = await pool.query(
      `INSERT INTO institute_documents (institute_id,client_id,client_name,file_name,file_key,file_size,content_type,file_data,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,institute_id,client_id,client_name,file_name,file_key,file_size,content_type,uploaded_at`,
      [institute_id, client_id||null, client_name||null, file_name, stored_key, file_size||null, content_type||null, stored_data, req.user.id]
    );
    const doc = rows[0];
    res.status(201).json({ ...doc, url: await getDownloadUrl(doc) });
  } catch(e) { next(e); }
});

// Delete document
router.delete('/:id', requireWriter, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM institute_documents WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const doc = rows[0];
    if (R2_ENABLED && doc.file_key && !doc.file_key.startsWith('db/')) {
      await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.file_key })).catch(() => {});
    }
    await pool.query('DELETE FROM institute_documents WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
