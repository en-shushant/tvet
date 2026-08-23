// routes/clients.js
const { pool } = require('../db/pool');
const { authenticate, requireAdmin, requireWriter } = require('../middleware/auth');

/**
 * Every table that points at a client, and how.
 *
 * A client is referenced two ways: by id, and — where it was typed rather than
 * picked — as free text. Merging has to move the first; adopting a typed name
 * has to convert the second into the first. Both operations are wrong the
 * moment one of these tables is forgotten, which is why the list is declared
 * once here instead of being spelled out at each call site.
 *
 * institute_documents carries no foreign key (its client_id is a plain integer),
 * so nothing would have complained had it been left out — it is the one most
 * worth naming explicitly.
 */
const CLIENT_REFS = [
  { table: 'assignments',    manual: 'client_name_manual' },
  { table: 'shortlists',     manual: 'client_name_manual' },
  { table: 'standing_lists', manual: 'client_name_manual' },
  { table: 'contracts',      manual: 'client_name_manual' },
  { table: 'institute_documents', manual: 'client_name' },
];

/**
 * How two typed names are judged to be the same client.
 *
 * Case and surrounding whitespace are never meaningful here, and internal runs
 * of whitespace are an artefact of typing rather than a distinction — the
 * occupation names in this database already carry doubled internal spaces from
 * exactly that, so `trim(lower(...))` alone would leave "Dept  of Roads" and
 * "Dept of Roads" as two different clients forever.
 */
const NORM = (col) => `regexp_replace(btrim(lower(coalesce(${col}, ''))), '\\s+', ' ', 'g')`;

/**
 * The subset of CLIENT_REFS whose tables exist right now.
 *
 * institute_documents is created on the first request to the documents route
 * rather than at boot, so on an installation where nobody has opened Documents
 * yet the table is simply absent — and naming it in a query made every one of
 * these endpoints fail with "relation does not exist". Resolved per request
 * rather than cached, since the table can appear at any point in the process's
 * life.
 */
async function existingRefs() {
  const { rows } = await pool.query(
    `SELECT unnest($1::text[]) AS t, to_regclass(unnest($1::text[])) IS NOT NULL AS present`,
    [CLIENT_REFS.map(r => r.table)]);
  const present = new Set(rows.filter(r => r.present).map(r => r.t));
  return CLIENT_REFS.filter(r => present.has(r.table));
}

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    return (await pool.query('SELECT * FROM clients WHERE is_active=TRUE ORDER BY short_name')).rows;
  });

  /**
   * How much each client is carrying, so the merge dialog can say which one to
   * keep rather than making it a guess.
   */
  fastify.get('/usage', async (request, reply) => {
    const refs = await existingRefs();
    const counts = refs.map(r =>
      `(SELECT COUNT(*) FROM ${r.table} x WHERE x.client_id = c.id)::int`).join(' + ');
    const { rows } = await pool.query(`
      SELECT c.id,
             (SELECT COUNT(*) FROM assignments a WHERE a.client_id = c.id)::int AS assignments,
             (${counts}) AS records
      FROM clients c WHERE c.is_active = TRUE`);
    return rows;
  });

  /**
   * Client names that were typed in rather than picked from this list.
   *
   * Two kinds come back and the difference matters. `matches` non-null means
   * the name already exists in master data and was simply typed instead of
   * selected — that wants linking, not a second copy. `matches` null is a
   * client genuinely missing from master data.
   *
   * Making that distinction here is the point: adding every typed name blindly
   * would manufacture exactly the duplicates the merge endpoint below exists to
   * clean up.
   */
  fastify.get('/unlinked', async (request, reply) => {
    const refs = await existingRefs();
    const parts = refs.map(r => `
      SELECT ${NORM(r.manual)} AS key, btrim(${r.manual}) AS name, '${r.table}' AS src
      FROM ${r.table}
      WHERE client_id IS NULL AND btrim(coalesce(${r.manual}, '')) <> ''`);

    const { rows } = await pool.query(`
      WITH typed AS (${parts.join(' UNION ALL ')}),
      grouped AS (
        SELECT key,
               COUNT(*)::int AS uses,
               COUNT(*) FILTER (WHERE src = 'assignments')::int AS assignments,
               array_agg(DISTINCT src) AS tables
        FROM typed GROUP BY key
      )
      -- LATERAL ... LIMIT 1 rather than a plain join: a registry that already
      -- holds the same client twice would otherwise match both and list the
      -- typed name once per duplicate — in exactly the registry this screen
      -- exists to tidy up.
      SELECT g.*, n.name, m.id AS match_id, m.short_name AS match_short_name, m.full_name AS match_full_name
      FROM grouped g
      -- Which spelling to propose as the master record's name. This is the one
      -- most people will accept without editing, so picking badly here creates
      -- the next duplicate rather than resolving this one: most-used first,
      -- then one that carries capitals over an all-lowercase variant, then the
      -- shortest (which drops the doubled internal spaces typing leaves behind).
      JOIN LATERAL (
        SELECT t.name
        FROM typed t
        WHERE t.key = g.key
        GROUP BY t.name
        ORDER BY COUNT(*) DESC, (t.name = lower(t.name)), length(t.name), t.name
        LIMIT 1
      ) n ON TRUE
      LEFT JOIN LATERAL (
        SELECT c.id, c.short_name, c.full_name
        FROM clients c
        WHERE c.is_active = TRUE
          AND (${NORM('c.full_name')} = g.key OR ${NORM('c.short_name')} = g.key)
        ORDER BY c.id
        LIMIT 1
      ) m ON TRUE
      ORDER BY g.uses DESC, n.name`);
    return rows;
  });

  /**
   * Take a typed-in client name into master data — or onto an existing client —
   * and repoint every record that used the text.
   *
   * Creating the row without the repointing would be the worst of both worlds:
   * master data would gain an entry while the assignments carried on as free
   * text, so nothing would join and the name would still show up as unlinked.
   */
  fastify.post('/adopt', { preHandler: requireWriter }, async (request, reply) => {
    const name = (request.body?.name || '').trim();
    if (!name) return reply.code(400).send({ error: 'name required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let target;
      if (request.body?.clientId) {
        const { rows } = await client.query(
          'SELECT * FROM clients WHERE id=$1 AND is_active=TRUE', [request.body.clientId]);
        if (!rows.length) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'Client not found' }); }
        target = rows[0];
      } else {
        const full = (request.body.full_name || name).trim();
        const short = (request.body.short_name || '').trim();
        if (!short) { await client.query('ROLLBACK'); return reply.code(400).send({ error: 'short_name required' }); }
        // A name that already exists is linked rather than duplicated, however
        // this endpoint was called.
        const { rows: dupe } = await client.query(
          `SELECT * FROM clients WHERE is_active = TRUE
             AND (${NORM('full_name')} = ${NORM('$1')} OR ${NORM('short_name')} = ${NORM('$2')})`,
          [full, short]);
        target = dupe[0] || (await client.query(
          `INSERT INTO clients (full_name, short_name, type, address, remarks)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [full, short, request.body.type || 'Government',
           request.body.address || null, request.body.remarks || null])).rows[0];
      }

      let linked = 0;
      for (const r of await existingRefs()) {
        const res = await client.query(
          `UPDATE ${r.table} SET client_id = $1, ${r.manual} = NULL
           WHERE client_id IS NULL AND ${NORM(r.manual)} = ${NORM('$2')}`,
          [target.id, name]);
        linked += res.rowCount;
      }

      await client.query('COMMIT');
      return { client: target, linked, created: !request.body?.clientId };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Client adopt failed:', err);
      const detail = [err.code && `[${err.code}]`, err.message, err.detail, err.constraint]
        .filter(Boolean).join(' ');
      return reply.code(500).send({ error: 'Could not add the client: ' + (detail || 'unknown database error') });
    } finally { client.release(); }
  });

  /**
   * Fold one or more clients into another.
   *
   * Mirrors the occupation merge: sources are deactivated rather than deleted,
   * so a merge made in error is undone by flipping is_active back instead of
   * restoring a backup. The client_id foreign keys are ON DELETE SET NULL, so
   * deleting a source would silently orphan its assignments rather than fail —
   * which is precisely why this repoints first and never deletes.
   */
  fastify.post('/merge', { preHandler: requireAdmin }, async (request, reply) => {
    const targetId = parseInt(request.body?.targetId, 10);
    const sourceIds = (request.body?.sourceIds || [])
      .map(n => parseInt(n, 10))
      .filter(n => Number.isInteger(n) && n !== targetId);

    if (!Number.isInteger(targetId)) return reply.code(400).send({ error: 'targetId required' });
    if (!sourceIds.length) return reply.code(400).send({ error: 'at least one other client to merge' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: found } = await client.query(
        'SELECT id, short_name, full_name FROM clients WHERE id = ANY($1::int[]) AND is_active = TRUE',
        [[targetId, ...sourceIds]]);
      if (!found.some(r => r.id === targetId)) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Target client not found' });
      }

      const moved = {};
      for (const r of await existingRefs()) {
        const res = await client.query(
          `UPDATE ${r.table} SET client_id = $1 WHERE client_id = ANY($2::int[])`,
          [targetId, sourceIds]);
        moved[r.table] = res.rowCount;
      }

      const deactivated = await client.query(
        'UPDATE clients SET is_active = FALSE WHERE id = ANY($1::int[]) RETURNING id, short_name, full_name',
        [sourceIds]);

      await client.query('COMMIT');
      return {
        target: found.find(r => r.id === targetId),
        merged: deactivated.rows,
        moved,
        movedTotal: Object.values(moved).reduce((a, b) => a + b, 0),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Client merge failed:', err);
      const detail = [err.code && `[${err.code}]`, err.message, err.detail, err.constraint]
        .filter(Boolean).join(' ');
      return reply.code(500).send({ error: 'Merge failed: ' + (detail || 'unknown database error') });
    } finally { client.release(); }
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { full_name, short_name, type, address, remarks,
            phone, email, website, signatory_name, signatory_position, letterhead,
            name_np, address_np, includes_ojt } = request.body;
    if (!full_name || !short_name) return reply.code(400).send({ error: 'full_name and short_name required' });
    const { rows } = await pool.query(
      `INSERT INTO clients (full_name,short_name,type,address,remarks,
        phone,email,website,signatory_name,signatory_position,letterhead,
        name_np,address_np,includes_ojt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [full_name,short_name,type,address,remarks,
       phone||null,email||null,website||null,signatory_name||null,signatory_position||null,letterhead||null,
       name_np||null,address_np||null,!!includes_ojt]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { full_name, short_name, type, address, remarks,
            phone, email, website, signatory_name, signatory_position, letterhead,
            name_np, address_np, includes_ojt } = request.body;
    const { rows } = await pool.query(
      `UPDATE clients SET full_name=$1,short_name=$2,type=$3,address=$4,remarks=$5,
        phone=$6,email=$7,website=$8,signatory_name=$9,signatory_position=$10,letterhead=$11,
        name_np=$12,address_np=$13,includes_ojt=$15
       WHERE id=$14 RETURNING *`,
      [full_name,short_name,type,address,remarks,
       phone||null,email||null,website||null,signatory_name||null,signatory_position||null,letterhead||null,
       name_np||null,address_np||null,
       request.params.id,!!includes_ojt]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { rows } = await pool.query('SELECT COUNT(*) FROM assignments WHERE client_id=$1', [request.params.id]);
    if (parseInt(rows[0].count) > 0) {
      await pool.query('UPDATE clients SET is_active=FALSE WHERE id=$1', [request.params.id]);
      return { deactivated: true };
    }
    await pool.query('DELETE FROM clients WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
