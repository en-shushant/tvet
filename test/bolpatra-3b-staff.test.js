/**
 * 3(B) Specific Experience mirrors the official Standard EOI Document's own
 * box exactly — six field-rows plus the services footer, no more. "Name of
 * Senior Staff" and "No. of Staff" are not fields on that form, so even
 * though the assignment still captures them (staffCount, seniorStaffDescription
 * — used elsewhere, e.g. the assignment form and gap tracking), 3(B)'s printed
 * output must not include them.
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

describe('3(B) matches the official form — no Senior Staff / No. of Staff row', () => {
  it('does not print "No. of Staff", even when the assignment has a count', () => {
    const out = html3b(baseExp({ staffCount: '4' }), { id: 1, name: 'Test Firm' });
    expect(out).not.toContain('No. of Staff');
  });

  it('does not print "Name of Senior Staff", even for a firm with a key-staff roster', () => {
    const inst = { id: 1, name: 'Test Firm', keyStaff: [{ name: 'Jane Doe', position: 'Team Leader' }] };
    const out = html3b(baseExp(), inst);
    expect(out).not.toContain('Name of Senior Staff');
    expect(out).not.toContain('Jane Doe');
  });

  it('ends the field box at Narrative description, straight into the services footer', () => {
    const out = html3b(baseExp(), { id: 1, name: 'Test Firm' });
    const narrativeIdx = out.indexOf('Narrative description of Project');
    const footerIdx = out.indexOf('Description of actual services provided in the assignment');
    expect(narrativeIdx).toBeGreaterThan(-1);
    expect(footerIdx).toBeGreaterThan(narrativeIdx);
  });
});

// fillSeniorStaffText itself is still used elsewhere (the assignment form's own
// "Senior staff description" auto-fill) — only its appearance inside the 3(B)
// print output was removed above.
describe('fillSeniorStaffText — auto-fill from the key-staff roster', () => {
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

  it('a position-less entry still prints, by name alone', () => {
    const noPosition = { id: 6, name: 'Firm', keyStaff: [{ name: 'Solo Staffer' }] };
    const text = fillSeniorStaffText(baseExp(), noPosition, clients);
    expect(text).toContain('Solo Staffer');
    expect(text).not.toContain('Solo Staffer —');
  });
});
