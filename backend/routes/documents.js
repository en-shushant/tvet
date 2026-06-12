// routes/documents.js — institute client documents stored in PostgreSQL
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter } = require('../middleware/auth');

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
    file_data TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID
  )`);
  // Add file_data column to existing tables
  await pool.query(`ALTER TABLE institute_documents ADD COLUMN IF NOT EXISTS file_data TEXT`).catch(() => {});
};

router.use(authenticate);

// List documents for an institute (optionally filter by client_id)
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
    // Attach download URL (served by this API)
    const docs = rows.map(doc => ({ ...doc, url: `/api/documents/${doc.id}/download` }));
    res.json(docs);
  } catch(e) { next(e); }
});

// Download a document
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

// Upload document (base64 encoded in request body)
router.post('/', requireWriter, async (req, res, next) => {
  try {
    await ensureTable();
    const { institute_id, client_id, client_name, file_name, file_size, content_type, file_data } = req.body;
    if (!institute_id || !file_name || !file_data) return res.status(400).json({ error: 'institute_id, file_name, file_data required' });
    const ext = file_name.split('.').pop();
    const file_key = `institutes/${institute_id}/${client_id || 'general'}/${Date.now()}.${ext}`;
    const { rows } = await pool.query(
      `INSERT INTO institute_documents (institute_id,client_id,client_name,file_name,file_key,file_size,content_type,file_data,uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,institute_id,client_id,client_name,file_name,file_key,file_size,content_type,uploaded_at`,
      [institute_id, client_id||null, client_name||null, file_name, file_key, file_size||null, content_type||null, file_data, req.user.id]
    );
    res.status(201).json({ ...rows[0], url: `/api/documents/${rows[0].id}/download` });
  } catch(e) { next(e); }
});

// Delete document
router.delete('/:id', requireWriter, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id FROM institute_documents WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    await pool.query('DELETE FROM institute_documents WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
