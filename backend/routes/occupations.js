// routes/occupations.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const { sector, search } = request.query;
    let q = 'SELECT * FROM occupations WHERE is_active=TRUE';
    const params = [];
    if (sector) { params.push(sector); q += ` AND sector=$${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND name ILIKE $${params.length}`; }
    q += ' ORDER BY sector, name';
    return (await pool.query(q, params)).rows;
  });

  /**
   * How much each occupation is actually used.
   *
   * Needed before merging: the list is full of near-duplicates ("Commis III"
   * and "General Cook (Commis III)", two spellings of "House Keeping Cleaner")
   * and the only safe way to choose which survives is to see which one the data
   * is attached to.
   */
  fastify.get('/usage', async (request, reply) => {
    const { rows } = await pool.query(`
      SELECT o.id,
             COUNT(DISTINCT ao.id)::int AS assignments,
             COUNT(DISTINCT ot.id)::int AS tools
      FROM occupations o
      LEFT JOIN assignment_occupations ao ON ao.ctevt_occupation_id = o.id
      LEFT JOIN occupation_tools ot       ON ot.occupation_id = o.id
      WHERE o.is_active = TRUE
      GROUP BY o.id`);
    return rows;
  });

  /**
   * Fold one or more occupations into another.
   *
   * Everything pointing at a source has to be repointed *before* the source
   * goes, and the two foreign keys fail in opposite directions if it is not:
   * assignment_occupations.ctevt_occupation_id is ON DELETE SET NULL, so
   * assignments would quietly lose their occupation, while
   * occupation_tools.occupation_id is ON DELETE CASCADE, so that occupation's
   * whole tool list would be destroyed.
   *
   * Sources are deactivated rather than deleted, matching what DELETE /:id
   * already does here, so a merge made in error can be undone by flipping
   * is_active back rather than restoring a backup.
   *
   * name_in_letter on each assignment row is untouched: it records what the
   * client called the trade, which is worth keeping even once the occupations
   * behind it are unified.
   */
  fastify.post('/merge', { preHandler: requireAdmin }, async (request, reply) => {
    const targetId = parseInt(request.body?.targetId, 10);
    const sourceIds = (request.body?.sourceIds || [])
      .map(n => parseInt(n, 10))
      .filter(n => Number.isInteger(n) && n !== targetId);

    if (!Number.isInteger(targetId)) return reply.code(400).send({ error: 'targetId required' });
    if (!sourceIds.length) return reply.code(400).send({ error: 'at least one other occupation to merge' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: found } = await client.query(
        'SELECT id, name FROM occupations WHERE id = ANY($1::int[]) AND is_active = TRUE',
        [[targetId, ...sourceIds]]);
      if (!found.some(r => r.id === targetId)) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Target occupation not found' });
      }

      const moved = await client.query(
        `UPDATE assignment_occupations SET ctevt_occupation_id = $1
         WHERE ctevt_occupation_id = ANY($2::int[])`,
        [targetId, sourceIds]);

      // A tool the target already has at that level is a duplicate, not a
      // second item; matched on level and description, which is what the tools
      // list is keyed by.
      const dropped = await client.query(
        `DELETE FROM occupation_tools s
         WHERE s.occupation_id = ANY($2::int[])
           AND EXISTS (SELECT 1 FROM occupation_tools t
                       WHERE t.occupation_id = $1
                         AND t.level = s.level
                         AND lower(trim(coalesce(t.description,''))) = lower(trim(coalesce(s.description,''))))`,
        [targetId, sourceIds]);

      const movedTools = await client.query(
        `UPDATE occupation_tools SET occupation_id = $1 WHERE occupation_id = ANY($2::int[])`,
        [targetId, sourceIds]);

      const deactivated = await client.query(
        'UPDATE occupations SET is_active = FALSE WHERE id = ANY($1::int[]) RETURNING id, name',
        [sourceIds]);

      await client.query('COMMIT');
      return {
        target: found.find(r => r.id === targetId),
        merged: deactivated.rows,
        movedAssignments: moved.rowCount,
        movedTools: movedTools.rowCount,
        droppedDuplicateTools: dropped.rowCount,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Occupation merge failed:', err);
      // pg puts the useful part in code/detail/constraint, not in message.
      const detail = [err.code && `[${err.code}]`, err.message, err.detail, err.constraint]
        .filter(Boolean).join(' ');
      return reply.code(500).send({ error: 'Merge failed: ' + (detail || 'unknown database error') });
    } finally {
      client.release();
    }
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { name, sector, duration, level } = request.body;
    if (!name || !sector) return reply.code(400).send({ error: 'name and sector required' });
    const { rows } = await pool.query(
      'INSERT INTO occupations (name,sector,duration,level,is_custom) VALUES ($1,$2,$3,$4,TRUE) RETURNING *',
      [name, sector, duration || null, level || null]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { name, sector, duration, level } = request.body;
    if (!name || !sector) return reply.code(400).send({ error: 'name and sector required' });
    const { rows } = await pool.query(
      'UPDATE occupations SET name=$1,sector=$2,duration=$3,level=$4 WHERE id=$5 RETURNING *',
      [name, sector, duration || null, level || null, request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await pool.query('UPDATE occupations SET is_active=FALSE WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
