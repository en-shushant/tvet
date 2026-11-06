import { describe, it, expect } from 'vitest';
import { firmGaps, gapsByForm } from '../src/utils/firmGaps.js';

const full = {
  id: 1, name_ok: true, address: true, contact_person: true, contact_designation: true, sign: true, stamp: true,
  reg_no: true, reg_date: true, pan: true, constitution_type: true, email: true, phone: true, org_profile: true,
  total_staff: true, professional_staff: true, key_staff: 2, turnover: 1, infrastructure: 3,
  tax_clearance: 1, ocr_registration: true, vat_registration: true, assignments: 4, assignments_incomplete: 0,
};

describe('firmGaps', () => {
  it('reports nothing for a complete firm', () => { expect(firmGaps(full)).toEqual([]); });
  it('reports nothing when there are no facts yet', () => { expect(firmGaps(undefined)).toEqual([]); });
  it('groups missing fields under the form that prints them', () => {
    const g = gapsByForm({ ...full, sign: false, stamp: false, total_staff: false, tax_clearance: 0 });
    expect(g.map(x => x.form)).toEqual(['letter', 'capacity', 'evidence']);
    expect(g[0].items.map(i => i.key)).toEqual(['sign', 'stamp']);
  });
  it('wants a turnover figure, not just a tax clearance record', () => {
    expect(firmGaps({ ...full, turnover: 0 }).map(g => g.key)).toEqual(['turnover']);
  });
  it('flags a firm with no assignments, and counts incomplete ones', () => {
    expect(firmGaps({ ...full, assignments: 0 }).map(g => g.key)).toContain('assignments');
    const g = firmGaps({ ...full, assignments: 5, assignments_incomplete: 2 });
    expect(g.find(x => x.key === 'incomplete').label).toBe('2 of 5 assignments missing details');
  });
});
