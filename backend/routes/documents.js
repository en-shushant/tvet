// routes/documents.js — institute client documents via Cloudflare R2
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
});
const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || '';
const PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL || '').replace(/\/$/, '');

const ensureTable = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS institute_documents (
    id SERIAL PRIMARY KEY,
    institute_id INTEGER NOT NULL,
    client_id UUID,
    client_name TEXT,
    file_name TEXT NOT NULL,
    file_key TEXT NOT NULL,
    file_size INTEGER,
    content_type TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID
  )`);
};

router.use(authenticate);

// List documents for an institute (optionally filter by client_id)
router.get('/', async (req, res, next) => {
  try {
    await ensureTable();
    const { institute_id, client_id } = req.query;
    if (!institute_id) return res.status(400).json({ error: 'institute_id required' });
    let q = 'SELECT * FROM institute_documents WHERE institute_id=$1';
    const params = [institute_id];
    if (client_id) { params.push(client_id); q += ` AND client_id=$${params.length}`; }
    q += ' ORDER BY uploaded_at DESC';
    const { rows } = await pool.query(q, params);
    // Attach presigned download URLs
    const docs = await Promise.all(rows.map(async (doc) => {
      let url = PUBLIC_URL ? `${PUBLIC_URL}/${doc.file_key}` : null;
      if (!url) {
        url = await getSignedUrl(R2, new GetObjectCommand({ Bucket: BUCKET, Key: doc.file_key }), { expiresIn: 3600 }).catch(() => null);
      }
      return { ...doc, url };
    }));
    res.json(docs);
  } catch(e) { next(e); }
});

// Get presigned upload URL
router.post('/presign', requireWriter, async (req, res, next) => {
  try {
    if (!BUCKET) return res.status(503).json({ error: 'R2 not configured' });
    const { file_name, content_type, institute_id, client_id } = req.body;
    if (!file_name || !institute_id) return res.status(400).json({ error: 'file_name and institute_id required' });
    const ext = file_name.split('.').pop();
    const key = `institutes/${institute_id}/${client_id || 'general'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadUrl = await getSignedUrl(R2,
      new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: content_type || 'application/octet-stream' }),
      { expiresIn: 300 }
    );
    res.json({ upload_url: uploadUrl, key });
  } catch(e) { next(e); }
});

// Save document metadata after successful upload
router.post('/', requireWriter, async (req, res, next) => {
  try {
    await ensureTable();
    const { institute_id, client_id, client_name, file_name, file_key, file_size, content_type } = req.body;
    if (!institute_id || !file_name || !file_key) return res.status(400).json({ error: 'institute_id, file_name, file_key required' });
    const { rows } = await pool.query(
      `INSERT INTO institute_documents (institute_id,client_id,client_name,file_name,file_key,file_size,content_type,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [institute_id, client_id||null, client_name||null, file_name, file_key, file_size||null, content_type||null, req.user.id]
    );
    let url = PUBLIC_URL ? `${PUBLIC_URL}/${file_key}` : null;
    if (!url) url = await getSignedUrl(R2, new GetObjectCommand({ Bucket: BUCKET, Key: file_key }), { expiresIn: 3600 }).catch(() => null);
    res.status(201).json({ ...rows[0], url });
  } catch(e) { next(e); }
});

// Delete document
router.delete('/:id', requireWriter, async (req, res, next) => {
  try {
    await ensureTable();
    const { rows } = await pool.query('SELECT * FROM institute_documents WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const doc = rows[0];
    if (BUCKET) await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.file_key })).catch(() => {});
    await pool.query('DELETE FROM institute_documents WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
