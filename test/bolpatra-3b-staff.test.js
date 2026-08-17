/**
 * 3(B) Specific Experience — "No. of Staff" and the senior-staff field.
 *
 * The RFP's own 3(B) template carries two fields TVETtrack had never captured:
 * a per-assignment staff count, and "Name of Senior Staff and Designation ...
 * Involved and Functions Performed". The second is written from the firm's
 * key-staff roster the same way the three narrative fields are written from
 * their assigned templates — stored text wins, the roster is the fallback,
 * and an empty roster prints a dash rather than inventing names.
 */
import { describe, it, expect } from 'vitest';
import bolpatra from '../src/reports/bolpatra.jsx';
import { fillSeniorStaffText } from '../src/utils/specificTemplates.js';

const baseExp = (over = {}) => ({
  id: 1, fy: '2081/82', assignmentName: 'Skills for Employment', clientId: 1,
  contractValue: '2500000', startDate: '2082/01/15', endDate: '2082/04/10',
  occupations: [{ id: 'o1', nameInLetter: 'Beautician', trainees: '40', locations: [{ district: 'Kathmandu' }] }],
  ...over,
});

const clients = [{ id: 1, fullName: 'Nepal Electricity Authority', shortName: 'NEA' }];

const html3b = (exp, inst, opts = {}) =>
  bolpatra.buildPrintHTML(inst, [exp], clients, '3b', null, { clients, ...opts });

describe('3(B) No. of Staff', () => {
  it('prints the stored count', () => {
    const out = html3b(baseExp({ staffCount: '4' }), { id: 1, name: 'Test Firm' });
    expect(out).toContain('No. of Staff');
    expect(out).toMatch(/No\. of Staff[\s\S]{0,40}>4</);
  });

  it('has no fallback — prints a dash when blank', () => {
    const out = html3b(baseExp({ staffCount: '' }), { id: 1, name: 'Test Firm' });
    expect(out).toMatch(/No\. of Staff[\s\S]{0,60}&mdash;/);
  });
});

describe('3(B) senior staff — auto-fill from the key-staff roster', () => {
  const inst = { id: 1, name: 'Test Firm', keyStaff: [
    { name: 'Jane Doe', position: 'Team Leader' },
    { name: 'Ram Sharma', position: 'Project Director' },
  ] };

  it('lists every name and position from the roster', () => {
    const text = fillSeniorStaffText(baseExp(), inst, clients);
    expect(text).toContain('Jane Doe — Team Leader');
    expect(text).toContain('Ram Sharma — Project Director');
  });

  it('names both people in the functions-performed sentence', () => {
    const text = fillSeniorStaffText(baseExp(), inst, clients);
    expect(text).toContain('Jane Doe and Ram Sharma were responsible');
  });

  it('names the client in the auto-generated sentence', () => {
    // buildTemplateValues prefers the short name — matches the other three
    // narrative templates, which read {client} the same way.
    const text = fillSeniorStaffText(baseExp(), inst, clients);
    expect(text).toContain('coordination with NEA');
  });

  it('returns nothing for a firm with no roster', () => {
    expect(fillSeniorStaffText(baseExp(), { id: 2, name: 'No Roster Firm' }, clients)).toBe('');
    expect(fillSeniorStaffText(baseExp(), { id: 3, name: 'Empty Roster', keyStaff: [] }, clients)).toBe('');
  });

  it('ignores roster entries with no name', () => {
    const withBlank = { id: 4, name: 'Firm', keyStaff: [{ name: '', position: 'Ghost' }] };
    expect(fillSeniorStaffText(baseExp(), withBlank, clients)).toBe('');
  });

  it('flows through into the rendered 3(B) document', () => {
    const out = html3b(baseExp(), inst);
    expect(out).toContain('Name of Senior Staff and Designation');
    expect(out).toContain('Jane Doe');
    expect(out).toContain('Ram Sharma');
  });

  it('a manually typed value overrides the roster', () => {
    const out = html3b(baseExp({ seniorStaffDescription: 'Custom senior staff text.' }), inst);
    expect(out).toContain('Custom senior staff text.');
    expect(out).not.toContain('Jane Doe');
  });

  it('prints a dash rather than fabricating staff for a firm with no roster', () => {
    const out = html3b(baseExp(), { id: 5, name: 'No Roster Firm' });
    expect(out).toMatch(/Name of Senior Staff[\s\S]{0,200}&mdash;/);
  });

  it('a position-less entry still prints, by name alone', () => {
    const noPosition = { id: 6, name: 'Firm', keyStaff: [{ name: 'Solo Staffer' }] };
    const text = fillSeniorStaffText(baseExp(), noPosition, clients);
    expect(text).toContain('Solo Staffer');
    expect(text).not.toContain('Solo Staffer —');
  });
});
