import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { maskBsDate, isBsDate, bsDaysBetween, normaliseQual, emptyTraining,
         DEFAULT_LANGUAGES, TOT_TITLE } from '../src/components/pool/common.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');

describe('BS date entry', () => {
  it('puts the slashes in as you type', () => {
    expect(maskBsDate('2058')).toBe('2058');
    expect(maskBsDate('205809')).toBe('2058/09');
    expect(maskBsDate('20580911')).toBe('2058/09/11');
    expect(maskBsDate('2058/9/11')).toBe('2058/09/11');
  });
  it('knows a complete date', () => {
    expect(isBsDate('2058/09/11')).toBe(true);
    expect(isBsDate('2058/13/11')).toBe(false);
    expect(isBsDate('2058/09')).toBe(false);
  });
  it('counts days only inside the calendar table', () => {
    expect(bsDaysBetween('2081/01/01', '2081/01/21')).toBe(21);
    expect(bsDaysBetween('2060/01/01', '2060/01/21')).toBeNull();
  });
});

describe('TOT', () => {
  it('starts titled Training of Trainers', () => {
    expect(emptyTraining('TOT').title).toBe(TOT_TITLE);
    expect(emptyTraining('Training').title).toBe('');
  });
  it('takes its year and duration from the dates', () => {
    const out = normaliseQual({ ...emptyTraining('TOT'), title: '', start_date: '2081/01/01', end_date: '2081/01/21' });
    expect(out.title).toBe(TOT_TITLE);
    expect(out.passed_year).toBe('2081');
    expect(out.duration_days).toBe(21);
    expect(out.duration_text).toBe('21 days, 2081/01/01 – 2081/01/21');
  });
  it('keeps a typed day count when the dates are outside the table', () => {
    const out = normaliseQual({ ...emptyTraining('TOT'), start_date: '2070/01/01', end_date: '2070/01/10', duration_days: '10' });
    expect(out.duration_days).toBe(10);
  });
});

describe('person form', () => {
  const src = read('src/components/pool/PersonEditor.jsx');
  it('no longer asks for a designation, and CV asks only profession', () => {
    expect(src).not.toMatch(/label="Designation"/);
    expect(src).not.toMatch(/label="Nationality"/);
    expect(src).not.toMatch(/Key qualifications/);
    expect(src).toMatch(/label="Profession"/);
  });
  it('saves temporary as permanent unless ticked', () => {
    expect(src).toMatch(/temporary_address: tempDifferent \? form.temporary_address : form.permanent_address/);
  });
  it('defaults to Nepali and English', () => {
    expect(DEFAULT_LANGUAGES().map(l => l.language)).toEqual(['Nepali', 'English']);
  });
});

describe('vocational level ladder', () => {
  const hr = read('backend/routes/hr.js');
  it('a certificate grants the same trade at its level and below', () => {
    expect(hr).toMatch(/lower\(trim\(o2.name\)\) = lower\(trim\(o1.name\)\)/);
    expect(hr).toMatch(/LEVEL_RANK\('o2.level'\)\} BETWEEN 1 AND/);
  });
  it('academic rules carry no level', () => {
    expect(hr).toMatch(/\(kind === 'Skill Test' \|\| qual_level\) \? \(max_level \|\| null\) : null/);
  });
});

import { teachableLevels } from '../src/constants/education.js';
describe('levels a qualification teaches', () => {
  it('a skill test teaches its level and below', () => {
    expect(teachableLevels('Skill Test', 'Level 1')).toEqual(['Level 1']);
    expect(teachableLevels('Skill Test', 'Level 2')).toEqual(['Level 1', 'Level 2']);
    expect(teachableLevels('Skill Test', 'Level 3')).toEqual(['Level 1', 'Level 2', 'Level 3']);
  });
  it('academic levels follow the trainer norms', () => {
    expect(teachableLevels('Academic', 'TSLC')).toEqual(['Level 1', 'Level 2']);
    expect(teachableLevels('Academic', 'Diploma')).toEqual(['Level 1', 'Level 2', 'Level 3']);
    expect(teachableLevels('Academic', 'Bachelor')).toHaveLength(4);
    expect(teachableLevels('Training', 'Diploma')).toEqual([]);
  });
});

describe('technician certificate', () => {
  it('teaches up to Level 2', () => {
    expect(teachableLevels('Skill Test', 'Technician')).toEqual(['Level 1', 'Level 2']);
  });
});
