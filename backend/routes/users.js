// routes/users.js — user management (admin only)
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const ensureUserInstitutes = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS user_institutes (
    user_id UUID NOT NULL,
    institute_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, institute_id)
  )`);
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='user_institutes' AND column_name='user_id' AND data_type='integer'
      ) THEN
        DROP TABLE user_institutes;
        CREATE TABLE user_institutes (
          user_id UUID NOT NULL,
          institute_id INTEGER NOT NULL,
          PRIMARY KEY (user_id, institute_id)
        );
      END IF;
    END $$
  `);
};

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', { preHandler: requireAdmin }, async (request, reply) => {
    const query = request.user.role === 'superadmin'
      ? 'SELECT id, name, email, role, is_active, photo, created_at FROM users ORDER BY created_at DESC'
      : "SELECT id, name, email, role, is_active, photo, created_at FROM users WHERE role != 'superadmin' ORDER BY created_at DESC";
    const { rows } = await pool.query(query);
    return rows;
  });

  fastify.post('/', { preHandler: requireAdmin }, async (request, reply) => {
    const { name, email, password, role = 'editor', photo } = request.body;
    if (!name || !email || !password) return reply.code(400).send({ error: 'name, email and password required' });
    if ((role === 'admin' || role === 'superadmin') && request.user.role !== 'superadmin') {
      return reply.code(403).send({ error: 'Only superadmin can create admin users' });
    }
    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        'INSERT INTO users (name, email, password, role, is_active, photo) VALUES ($1,$2,$3,$4,TRUE,$5) RETURNING id, name, email, role, is_active, photo, created_at',
        [name, email, hash, role, photo||null]
      );
      return reply.code(201).send(rows[0]);
    } catch(e) {
      if (e.code === '23505') return reply.code(409).send({ error: 'Email already registered' });
      throw e;
    }
  });

  fastify.put('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { name, email, password, role, is_active, photo } = request.body;
    if ((role === 'admin' || role === 'superadmin') && request.user.role !== 'superadmin') {
      return reply.code(403).send({ error: 'Only superadmin can assign admin roles' });
    }
    let q, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      q = 'UPDATE users SET name=$1, email=$2, role=$3, is_active=$4, password=$5, photo=$6 WHERE id=$7 RETURNING id, name, email, role, is_active, photo, created_at';
      params = [name, email, role, is_active, hash, photo||null, request.params.id];
    } else {
      q = 'UPDATE users SET name=$1, email=$2, role=$3, is_active=$4, photo=$5 WHERE id=$6 RETURNING id, name, email, role, is_active, photo, created_at';
      params = [name, email, role, is_active, photo||null, request.params.id];
    }
    const { rows } = await pool.query(q, params);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireSuperAdmin }, async (request, reply) => {
    await pool.query('DELETE FROM users WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });

  fastify.get('/:id/institutes', { preHandler: requireAdmin }, async (request, reply) => {
    await ensureUserInstitutes();
    const { rows } = await pool.query(
      'SELECT institute_id FROM user_institutes WHERE user_id=$1', [request.params.id]
    );
    return rows.map(r => r.institute_id);
  });

  fastify.put('/:id/institutes', { preHandler: requireAdmin }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await ensureUserInstitutes();
      const { institute_ids = [] } = request.body;
      await client.query('BEGIN');
      await client.query('DELETE FROM user_institutes WHERE user_id=$1', [request.params.id]);
      for (const iid of institute_ids) {
        await client.query('INSERT INTO user_institutes (user_id, institute_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [request.params.id, iid]);
      }
      await client.query('COMMIT');
      return { assigned: institute_ids };
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });
}

module.exports = plugin;
