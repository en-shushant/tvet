/**
 * Running work is not experience — in any report family.
 *
 * An assignment marked "Currently running" is work in progress. It belongs in a
 * portfolio, which lists what a firm is doing, but not in an experience table,
 * which reports what it achieved. Every family's experience sections ask for
 * finished outcomes — trainees graduated, skill tests sat, employment secured —
 * and a training that has not ended has produced none of them.
 *
 * The rule is applied once, in the report builder, alongside the fiscal-year,
 * donor-type and duration filters that already narrow the set every family
 * receives. Putting it in each family would be six chances to forget it, and
 * five of those documents would go out claiming outcomes that do not exist.
 *
 * The builder's own paths are checked in the source rather than driven: reaching
 * a rendered preview needs a click on a Material button, which the test stub
 * renders as an inert host, so a click there would assert against the stub.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { completedOnly, isOngoingAssignment } from '../src/reports/helpers.js';

const read = (p) => readFileSync(path.resolve(import.meta.dirname, '..', p), 'utf8');

const done    = { id: 1, assignmentName: 'Finished work', isOngoing: false };
const running = { id: 2, assignmentName: 'Work under way', isOngoing: true };
const legacy  = { id: 3, assignmentName: 'Recorded before the flag existed' };

describe('the rule itself', () => {
  it('drops assignments marked as running', () => {
    expect(completedOnly([done, running]).map(e => e.id)).toEqual([1]);
  });

  it('treats an assignment with no mark as finished', () => {
    // Every row already in the registry predates the column. Reading a missing
    // value as "running" would empty every experience table in the system.
    expect(isOngoingAssignment(legacy)).toBe(false);
    expect(completedOnly([legacy]).map(e => e.id)).toEqual([3]);
  });

  it('survives being handed nothing', () => {
    expect(completedOnly(undefined)).toEqual([]);
    expect(completedOnly(null)).toEqual([]);
  });

  it('does not mutate what it is given', () => {
    const input = [done, running];
    completedOnly(input);
    expect(input).toHaveLength(2);
  });
});

describe('the report builder', () => {
  const source = read('src/components/ReportsView.jsx');

  it('imports the shared rule rather than re-deriving it', () => {
    expect(source).toMatch(/completedOnly.*from '\.\.\/reports\/helpers\.js'/);
    // No hand-rolled second copy of the same test.
    expect(source).not.toMatch(/filter\(\s*e\s*=>\s*!e\.isOngoing\s*\)/);
  });

  it('applies it to the single-firm path', () => {
    const block = source.slice(source.indexOf('const activeExps = useMemo'),
                               source.indexOf('// All training types present'));
    expect(block).toMatch(/return completedOnly\(filtered\)/);
  });

  it('applies it to the multi-firm path', () => {
    const block = source.slice(source.indexOf('const fwExpsFor = (inst)'),
                               source.indexOf('// Lead first, then the rest'));
    expect(block).toMatch(/return completedOnly\(exps\)/);
  });

  it('applies it last, after every other filter', () => {
    // Order does not change the result, but applying it last is what makes it
    // unconditional — no earlier `return` can skip past it.
    const block = source.slice(source.indexOf('const activeExps = useMemo'),
                               source.indexOf('// All training types present'));
    const returns = block.match(/return [^;]+;/g) || [];
    expect(returns.at(-1)).toMatch(/completedOnly/);
    expect(returns.filter(r => !r.includes('completedOnly') && !r.includes('filterDuration'))
      .filter(r => /^return filtered/.test(r))).toHaveLength(0);
  });
});

describe('the one table that looks past it', () => {
  it('is Bagmati B.1, which reads the firm rather than the narrowed set', () => {
    // Current Portfolio is "implementing or have implemented", so work under
    // way belongs there. It takes `inst`, not `exps`, which is how.
    const source = read('src/reports/bagmati.jsx');
    expect(source).toMatch(/if \(section === 'b1'\) return modelB1\(inst,/);
    expect(source).toMatch(/if \(section === 'b2'\) return modelB2\(exps,/);
    const b1 = source.slice(source.indexOf('function modelB1'), source.indexOf('function modelB2'));
    expect(b1).toMatch(/inst\?\.experience/);
  });

  it('and no other family reaches around the builder for its assignments', () => {
    // A family reading inst.experience for an experience table would step
    // straight past the filter.
    for (const f of ['helvetas', 'firmwise', 'detailed', 'enssure', 'bolpatra']) {
      expect(read(`src/reports/${f}.jsx`), f).not.toMatch(/inst\??\.\s*experience/);
    }
  });
});
