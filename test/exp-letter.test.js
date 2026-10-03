import { describe, it, expect } from 'vitest';
import { adMonthOf, letterModel, letterHTML } from '../src/reports/expLetter.js';
import { buildPrintHTML } from '../src/reports/cv.jsx';

const firm = { id: 1, name: 'CEMECA Human Resource Academy Pvt. Ltd.', reg_no: '33976/061/62', pan: '301884163', contact_person: 'Diamond Rijal' };
const letter = { firm, position: 'Main Trainer', occupation: 'Building Electrician', from_date: '2071/08/15', is_current: true,
  events_count: 33, clients: 'EVENT-II, ENSSURE, FEB, VSDTA, SAMRIDDHI', duties: ['• Prepared lesson plans'] };
const text = (runs) => runs.map(([t]) => t).join('');

describe('experience letter', () => {
  it('writes the start as the letter does: Dec 2014', () => {
    expect(adMonthOf('2071/08/15')).toBe('Dec 2014');
    expect(adMonthOf('')).toBe('');
  });
  it('states the same events and clients as the CV', () => {
    const m = letterModel(letter, { full_name: 'Raja Ram Prajapati', gender: 'Male' });
    expect(text(m.paragraphs[0])).toBe('This letter is to formally acknowledge that Raja Ram Prajapati has been employed with CEMECA Human Resource Academy Pvt. Ltd. as a Main Trainer in Building Electrician Occupation since Dec 2014.');
    expect(text(m.paragraphs[1])).toContain('He has conducted 33 training events under EVENT-II, ENSSURE, FEB, VSDTA, SAMRIDDHI projects.');
    expect(m.duties).toEqual(['Prepared lesson plans']);
  });
  it('agrees pronouns and verbs, and says "from … to" for someone who left', () => {
    const she = letterModel({ ...letter, is_current: false, to_date: '2079/03/30' }, { full_name: 'Sita', gender: 'Female', person_type: 'Support Staff' });
    expect(text(she.paragraphs[0])).toMatch(/Sita was employed with .* from Dec 2014 to Jul 2022\./);
    expect(text(she.paragraphs[1])).toContain('She has supported 33 training events');
    const them = letterModel(letter, { full_name: 'A', gender: '' });
    expect(text(them.paragraphs[1])).toContain('They have conducted');
  });
  it('follows each CV with its letters in the pack', () => {
    const cv = { person: { full_name: 'X', gender: 'Male' }, proposed_position: 'Main Trainer', education: [], trainings: [], experience: [], languages: [], letters: [letter] };
    const html = buildPrintHTML({ tender: { title: 'T' }, format: 'ppmo_eoi', cvs: [cv, cv] });
    expect(html.match(/<section class="(cv|xl)"/g).map(m => m.includes('xl') ? 'L' : 'C').join('')).toBe('CLCL');
    expect(buildPrintHTML({ tender: { title: 'T' }, format: 'ppmo_eoi', cvs: [cv] }, { letters: false })).not.toContain('class="xl"');
  });
  it('uses the firm’s letterhead when it has one, its text header otherwise', () => {
    expect(letterHTML(letter, { full_name: 'X' })).toContain('REGD. NO. 33976/061/62');
    expect(letterHTML({ ...letter, firm: { ...firm, letterhead: 'https://x/lh.png' } }, { full_name: 'X' })).not.toContain('REGD. NO.');
  });
});
