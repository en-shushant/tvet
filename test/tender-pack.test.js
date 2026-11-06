import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { packFigures, submitProblems, packNote, STANDARD_REQUIREMENTS, FORM_LABELS } from '../src/components/tenders/pack.js';
import { buildPackZip } from '../src/components/tenders/packZip.js';

describe('packFigures', () => {
  it('counts only the forms that are switched on', () => {
    const f = packFigures([
      { form_key: 'letter', enabled: true, status: 'Approved' },
      { form_key: 'capacity', enabled: false, status: 'Not started' },
      { form_key: 'experts', enabled: true, status: 'Draft' },
    ], []);
    expect(f.formsOn).toBe(2);
    expect(f.formsApproved).toBe(1);
  });
  it('counts open mandatory lines, not optional ones', () => {
    const f = packFigures([], [
      { mandatory: true, met: true }, { mandatory: true, met: false }, { mandatory: false, met: false },
    ]);
    expect(f.mandatoryOpen).toBe(1);
    expect(f.mandatoryMet).toBe(1);
    expect(f.reqTotal).toBe(3);
  });
  it('names every form in the Bolpatra set', () => {
    for (const k of ['letter', 'applicant', 'experience', 'capacity', 'experts', 'evidence']) expect(FORM_LABELS[k].name).toBeTruthy();
    expect(STANDARD_REQUIREMENTS.length).toBeGreaterThan(5);
  });
});

describe('submitProblems', () => {
  it('is empty when every mandatory line is met and every form approved', () => {
    expect(submitProblems([{ form_key: 'letter', enabled: true, status: 'Approved' }], [{ mandatory: true, met: true, label: 'x' }])).toEqual([]);
  });
  it('names open mandatory lines and unapproved forms, ignoring optional lines and forms switched off', () => {
    const p = submitProblems(
      [{ form_key: 'letter', enabled: true, status: 'Draft' }, { form_key: 'capacity', enabled: false, status: 'Not started' }],
      [{ mandatory: true, met: false, label: 'Tax clearance' }, { mandatory: false, met: false, label: 'Optional' }]);
    expect(p).toHaveLength(2);
    expect(p[0]).toContain('Tax clearance');
    expect(p[0]).not.toContain('Optional');
    expect(p[1]).toContain('Form 1');
    expect(p[1]).not.toContain('Form 4');
  });
});

describe('packNote and the zip', () => {
  it('lists the files, the form states and the checklist', () => {
    const t = packNote({ title: 'ZZ Tender', reference_no: 'R-1', stage: 'EOI' },
      [{ form_key: 'letter', enabled: true, status: 'Approved' }, { form_key: 'capacity', enabled: false }],
      [{ label: 'Tax clearance', mandatory: true, met: true }, { label: 'Extra', mandatory: false, met: false }], ['a.docx']);
    expect(t).toContain('ZZ Tender — R-1');
    expect(t).toContain('- a.docx');
    expect(t).toContain('Form 1 · Letter of Application: Approved');
    expect(t).toContain('Form 4 · Capacity: not asked for');
    expect(t).toContain('[x] Tax clearance');
    expect(t).toContain('[ ] Extra (optional)');
  });
  it('builds one zip with every file, keeping repeated names apart', async () => {
    const blob = await buildPackZip([{ name: 'a.txt', text: 'one' }, { name: 'a.txt', text: 'two' }, { name: 'dir/b.txt', text: 'three' }]);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['a (2).txt', 'a.txt', 'dir_b.txt']);
    expect(await zip.file('a (2).txt').async('string')).toBe('two');
  });
});
