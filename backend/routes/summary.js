// routes/summary.js
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { institute_id, fys, client_types } = req.query;
    if (!institute_id) return res.status(400).json({ error: 'institute_id required' });

    const fyList = fys ? fys.split(',').map(f => f.trim()) : [];
    const clientTypeList = client_types ? client_types.split(',').map(t => t.trim()) : [];

    let expQ = `
      SELECT ao.name_in_letter, ao.ctevt_occupation_id, o.name as ctevt_name, o.sector,
        ao.trainees, ao.skill_test_appeared, ao.skill_test_pass, ao.employment_actual_pct,
        c.short_name as client_name, c.id as client_id, c.type as client_type,
        al.district
      FROM assignments a
      JOIN assignment_occupations ao ON ao.assignment_id = a.id
      LEFT JOIN occupations o ON o.id = ao.ctevt_occupation_id
      LEFT JOIN clients c ON c.id = a.client_id
      LEFT JOIN assignment_locations al ON al.assignment_id = a.id
      WHERE a.institute_id = $1`;

    const expParams = [institute_id];
    if (fyList.length) { expParams.push(fyList); expQ += ` AND a.fiscal_year = ANY($${expParams.length})`; }
    if (clientTypeList.length) { expParams.push(clientTypeList); expQ += ` AND c.type = ANY($${expParams.length})`; }

    let nstbQ = `SELECT * FROM nstb_records WHERE institute_id = $1`;
    const nstbParams = [institute_id];
    if (fyList.length) { nstbParams.push(fyList); nstbQ += ` AND fiscal_year = ANY($${nstbParams.length})`; }

    const affQ = `SELECT af.status, af.expiry_date, af.affiliation_date, ap.name as program_name
      FROM affiliations af JOIN affiliation_programs ap ON ap.affiliation_id = af.id
      WHERE af.institute_id = $1`;

    const [expRes, nstbRes, affRes] = await Promise.all([
      pool.query(expQ, expParams),
      pool.query(nstbQ, nstbParams),
      pool.query(affQ, [institute_id]),
    ]);

    const rows = {};

    expRes.rows.forEach(row => {
      const key = row.ctevt_name || row.name_in_letter;
      if (!rows[key]) {
        rows[key] = {
          occupation: key, sector: row.sector || '—',
          clientIds: new Set(), clientNames: new Set(), clientTypes: new Set(),
          trainees: 0, stAppeared: 0, stPass: 0, districts: new Set(),
          nstbApplied: 0, nstbAppeared: 0, nstbPass: 0, nstbLevel: '—',
          affiliationStatus: '—', affiliationFrom: '—', affiliationTo: '—',
        };
      }
      const r = rows[key];
      r.clientIds.add(row.client_id);
      r.clientNames.add(row.client_name || '—');
      r.clientTypes.add(row.client_type || '—');
      r.trainees += parseInt(row.trainees) || 0;
      if (row.skill_test_appeared) r.stAppeared += parseInt(row.skill_test_appeared) || 0;
      if (row.skill_test_pass) r.stPass += parseInt(row.skill_test_pass) || 0;
      if (row.district) r.districts.add(row.district);
    });

    nstbRes.rows.forEach(n => {
      const matchKey = Object.keys(rows).find(k =>
        k.toLowerCase().includes(n.occupation.toLowerCase()) ||
        n.occupation.toLowerCase().includes(k.split(',')[0].toLowerCase())
      );
      if (matchKey) {
        rows[matchKey].nstbApplied += n.applied || 0;
        rows[matchKey].nstbAppeared += n.appeared || 0;
        rows[matchKey].nstbPass += n.pass || 0;
        rows[matchKey].nstbLevel = n.level;
      }
    });

    affRes.rows.forEach(aff => {
      const matchKey = Object.keys(rows).find(k =>
        aff.program_name && aff.program_name.toLowerCase().includes(k.split(',')[0].toLowerCase())
      );
      if (matchKey) {
        rows[matchKey].affiliationStatus = aff.status;
        rows[matchKey].affiliationFrom = aff.affiliation_date;
        rows[matchKey].affiliationTo = aff.expiry_date;
      }
    });

    const result = Object.values(rows).map(r => ({
      ...r,
      clientIds: r.clientIds.size,
      clientNames: [...r.clientNames].join(', '),
      clientTypes: [...r.clientTypes].join(', '),
      districts: [...r.districts],
      districtCount: r.districts.size,
      passRatePct: r.nstbAppeared > 0 ? ((r.nstbPass / r.nstbAppeared) * 100).toFixed(1) : null,
      appearRatePct: r.nstbApplied > 0 ? ((r.nstbAppeared / r.nstbApplied) * 100).toFixed(1) : null,
    }));

    res.json(result);
  } catch(e) { next(e); }
});

module.exports = router;
