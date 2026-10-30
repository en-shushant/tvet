import { describe, it, expect } from 'vitest';
import { adequacyBlock } from '../src/reports/adequacy.js';
import { buildPrintHTML } from '../src/reports/cv.jsx';

const base = {
  proposed_position: 'Main Trainer',
  person: { full_name: 'Sova Moktan', person_type: 'Trainer', gender: 'Female' },
  education: [
    { title: 'Diploma in Electrical Engineering', stream: 'Academic', passed_year: '2060' },
    { title: 'Level 1 — Assistant Beautician', stream: 'Vocational', passed_year: '2071' },
  ],
  trainings: [{ kind: 'TOT', title: 'Training of Trainers', institution: 'TITI', end_date_ad: '2008-09-26' }],
  experience: [
    { position: 'Main Trainer', organisation: 'World Link Technical Training Institute Pvt. Ltd.', from_date: '2078/05/11', is_current: true, events_count: 51, clients: 'FEB, CTEVT, EVENT' },
    { position: 'Instructor', organisation: 'Sunrise Training Centre', from_date: '2070/01/01', to_date: '2078/04/30' },
  ],
  detailed_tasks: '• Prepare lesson plans.\n• Conduct theory and practical classes.',
  adequacy_typed: false, adequacy_wording: '',
};
const lines = (t) => t.split('\n');

describe('the Adequacy row', () => {
  const { left, right } = adequacyBlock(base);
  it('puts the tasks on the left under a lead-in that agrees with the person', () => {
    expect(lines(left)).toEqual(['As a Main Trainer, she will', '• Prepare lesson plans.', '• Conduct theory and practical classes.']);
    expect(adequacyBlock({ ...base, person: { ...base.person, gender: 'Male' } }).left).toContain('As a Main Trainer, he will');
    expect(adequacyBlock({ ...base, person: { ...base.person, gender: '' } }).left).toContain('As a Main Trainer, they will');
    expect(adequacyBlock({ ...base, proposed_position: 'Instructor' }).left).toMatch(/^As an Instructor/);
  });
  it('says what they hold, their ToT, and the work they have done', () => {
    const para = lines(right)[0];
    expect(para).toContain('Ms Sova Moktan holds Diploma in Electrical Engineering (2060) and the NSTB skill certificate Level 1 — Assistant Beautician (2071).');
    expect(para).toContain('Also, she has received Training of Trainers (ToT) from TITI in 2008.');
    expect(para).toContain('She has worked as a Main Trainer with World Link Technical Training Institute Pvt. Ltd. since 2078, conducting 51 training events for FEB, CTEVT and EVENT.');
    expect(para).toContain('Earlier, she worked as Instructor at Sunrise Training Centre (2070 – 2078).');
    expect(para).toContain('Ms Sova Moktan is a qualified and experienced Main Trainer.');
  });
  it('then lists what they are capable of, as bullets', () => {
    const rest = lines(right).slice(1);
    expect(rest[0]).toBe('As a Main Trainer, she is:');
    expect(rest.slice(1).every(l => l.startsWith('• '))).toBe(true);
    expect(rest).toHaveLength(4);
  });
  it('is compact: one paragraph and three lines, not a row per task', () => {
    expect(lines(right)).toHaveLength(5);
  });
});

describe('when there is less to say', () => {
  it('leaves out what the record does not have, and never claims it', () => {
    const { right } = adequacyBlock({ ...base, trainings: [], education: [], experience: [] });
    expect(lines(right)[0]).toBe('Ms Sova Moktan is proposed as a Main Trainer for this assignment; qualifications and experience are set out in this CV.');
    expect(right).not.toMatch(/ToT|holds|worked/);
  });
  it('leaves out the event count when the firm does not state events', () => {
    const { right } = adequacyBlock({ ...base, show_events: false });
    expect(right).not.toContain('51');
    expect(right).toContain('on programmes of FEB, CTEVT and EVENT');
  });
  it('speaks of supporting, not conducting, for support staff', () => {
    const { right } = adequacyBlock({ ...base, person: { ...base.person, person_type: 'Support Staff' }, proposed_position: 'Database Officer' });
    expect(right).toContain('supporting 51 training events');
    expect(right).toContain('Capable of carrying out the assigned tasks');
  });
  it('gives a post with no tasks a lead-in rather than an empty cell', () => {
    expect(adequacyBlock({ ...base, detailed_tasks: '' }).left).toBe('As a Main Trainer, she will carry out the duties set out in the Terms of Reference for the post.');
  });
});

describe('written wording is kept as written', () => {
  it('uses text typed for this bid as the whole right cell', () => {
    expect(adequacyBlock({ ...base, adequacy_typed: true, adequacy: 'Ten years of delivery.\nTOT holder.' }).right).toBe('• Ten years of delivery.\n• TOT holder.');
    expect(adequacyBlock({ ...base, adequacy_typed: undefined, adequacy: '• Kept' }).right).toBe('• Kept');
  });
  it('uses the firm’s own wording as the capability lines, after the paragraph', () => {
    const { right } = adequacyBlock({ ...base, adequacy_wording: '• Holds the qualifications and TOT required.\n• Experienced in curriculum-based delivery.' });
    const rest = lines(right).slice(1);
    expect(rest).toEqual(['As a Main Trainer, she is:', '• Holds the qualifications and TOT required.', '• Experienced in curriculum-based delivery.']);
  });
});

describe('in the CV', () => {
  const html = buildPrintHTML({ tender: { title: 'T', institute_name: 'F' }, format: 'ppmo_rfp', cvs: [{ ...base, languages: [], letters: [] }] }, { letters: false });
  it('the lead-in is a paragraph and the tasks are bullets, in one row', () => {
    const table = html.match(/<table>(?:(?!<\/table>)[\s\S])*Detailed Tasks Assigned[\s\S]*?<\/table>/)[0];
    expect(table.split('<tbody>')[1].match(/<tr>/g)).toHaveLength(1);       // one body row, under the header
    expect(table).toContain('<p>As a Main Trainer, she will</p><ul><li>Prepare lesson plans.</li>');
    expect(table).toContain('<p>As a Main Trainer, she is:</p><ul>');
  });
});
