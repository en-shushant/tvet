import { describe, it, expect } from 'vitest';
import bolpatra, { model1, model5, keyExpertsFrom } from '../src/reports/bolpatra.jsx';

const lead = { id: 1, name: 'Alpha Academy', contactPerson: 'Thakur Subedi', address: 'Tokha', phone: '01-4000', email: 'a@x.np',
  keyStaff: [{ name: 'Sita Karki', position: 'Team Leader' }] };
const partner = { id: 2, name: 'Beta Institute' };
const tender = { title: 'Skill training for youths', applicant: 'ALPHA + BETA (JV)',
  client: { fullName: 'Employment Fund', address: 'Lalitpur', phone: '01-5000', email: 'ef@x.np' },
  keyExperts: [{ firmId: 1, name: 'Ram', position: 'M&E Officer', qualification: 'MBA', years: '6', specific: '4', nationality: 'Nepali' },
               { firmId: 2, name: 'Hari', position: 'Training Coordinator', qualification: 'BBS', years: '9', specific: '5', nationality: 'Nepali' }] };

describe('EOI Form 1 — Letter of Application', () => {
  it('fills the client, the work and the applicant from the tender', () => {
    const m = model1([{ inst: lead }, { inst: partner }], { tender });
    expect(m.paras[0]).toContain('on behalf of ALPHA + BETA (JV)');
    expect(m.paras[0]).toContain('short-listed by Employment Fund as Consultant for Skill training for youths.');
    expect(m.to[0]).toEqual(['Full Name of Client', 'Employment Fund']);
    expect(m.contact[0]).toBe('Thakur Subedi');
    expect(m.paras).toHaveLength(8);
  });
  it('leaves the form’s blanks when opened without a tender', () => {
    const m = model1([{ inst: lead }], {});
    expect(m.paras[0]).toContain('[Insert name of Client]');
    expect(m.paras[0]).toContain('[Insert brief description of Work/Services]');
  });
});

describe('EOI Form 5 — Key Experts', () => {
  it('lists each firm’s own key experts, at least five rows', () => {
    const a = model5(lead, { tender });
    expect(a.rows[0]).toEqual(['1', 'Ram', 'M&E Officer', 'MBA', '6', '4', 'Nepali']);
    expect(a.rows).toHaveLength(5);
    expect(model5(partner, { tender }).rows[0][1]).toBe('Hari');
  });
  it('falls back to the firm’s key-staff list without a tender', () => {
    expect(model5(lead, {}).rows[0]).toEqual(['1', 'Sita Karki', 'Team Leader', '', '', '', 'Nepali']);
  });
  it('builds rows from the tender’s CV pack — key-expert posts only, years from the jobs', () => {
    const now = (new Date().getFullYear() + 56);
    const pack = { tender: { lead_institute_id: 1 }, cvs: [
      { post_category: 'Key expert', proposed_position: 'M&E Officer', person: { full_name: 'Ram' },
        education: [{ title: 'MBA', passed_year: '2075' }, { title: 'BBS', passed_year: '2070' }],
        experience: [{ biddingFirm: true, institute_id: 2, position: 'M&E Officer', from_date: `${now - 4}/01/01`, is_current: true },
                     { position: 'Accountant', from_date: '2070/01/01', to_date: '2072/01/01' }] },
      { post_category: 'Trainer', proposed_position: 'Main Trainer', person: { full_name: 'X' }, education: [], experience: [] }] };
    const k = keyExpertsFrom(pack);
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ firmId: 2, name: 'Ram', qualification: 'MBA', nationality: 'Nepali' });
    expect(Number(k[0].years)).toBeGreaterThanOrEqual(5);
    expect(Number(k[0].specific)).toBeGreaterThanOrEqual(3);
  });
});

describe('the complete EOI document', () => {
  it('opens with the letter, ends with key experts, and prints both', () => {
    const html = bolpatra.buildMultiPrintHTML([{ inst: lead, exps: [] }, { inst: partner, exps: [] }], [], 'full', '', { tender });
    expect(html.indexOf('Letter of Application')).toBeLessThan(html.indexOf('Applicant&#39;s Information') === -1 ? html.indexOf('Applicant') : html.indexOf('Applicant&#39;s Information'));
    expect(html).toContain('Key Experts');
    expect(html.match(/1\.\s+Letter of Application/g)).toHaveLength(1);   // one letter for the whole JV
    expect(html).toContain('Hari');
  });
});
