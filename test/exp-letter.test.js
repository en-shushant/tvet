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

  describe('a richer letter', () => {
    const rich = { ...letter, trades: ['Plumber', 'Assistant Tailor'], duties: ['• a', '• b', '• c', '• d', '• e', '• f'],
      programmes: [
        { name: 'Skill training for returnee migrants', client: 'FEB', fy: '2080/81' },
        { name: 'Plumbing Level 2 training', client: 'CTEVT', fy: '2079/80' },
        ...Array.from({ length: 8 }, (_, i) => ({ name: `Programme ${i + 3}`, client: 'EVENT-II', fy: '2078/79' })),
      ] };
    const m = letterModel(rich, { full_name: 'Raja Ram Prajapati', gender: 'Male' });
    it('says which trades they trained in', () => {
      expect(text(m.paragraphs[1])).toContain('sound skills in vocational training in Plumber and Assistant Tailor, effectively imparting');
      expect(text(letterModel(letter, { full_name: 'X', gender: 'Male' }).paragraphs[1])).toContain('vocational training, effectively imparting');
    });
    it('lists the firm’s programmes during their time, newest first, with client and year', () => {
      expect(m.programmes.intro).toBe('The programmes that he has been part of with us include:');
      expect(m.programmes.items[0]).toBe('Skill training for returnee migrants — FEB, FY 2080/81');
      expect(m.programmes.items).toHaveLength(8);
      expect(m.programmes.more).toBe(2);
      expect(letterModel(letter, { full_name: 'X' }).programmes).toBeNull();
      const html = letterHTML(rich, { full_name: 'Raja', gender: 'Male' });
      expect(html).toContain('Skill training for returnee migrants — FEB, FY 2080/81');
      expect(html).toContain('and 2 more.');
    });
    it('gives up to six duties and a fuller closing', () => {
      expect(m.duties).toHaveLength(6);
      expect(text(m.closing[0])).toContain('maintains accurate attendance, assessment and training records');
      const they = letterModel(rich, { full_name: 'A', gender: '' });
      expect(text(they.closing[0])).toContain('They follow the approved curriculum, keep the workshop safe and orderly, and maintain accurate');
      expect(text(m.closing[1])).toContain('issued on request, for bidding and reference purposes');
      const staff = letterModel(letter, { full_name: 'Sita', gender: 'Female', person_type: 'Support Staff' });
      expect(text(staff.closing[0])).toContain('she keeps records and reports accurate and on time');
    });
  });
});
