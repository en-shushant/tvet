/**
 * The gap check must agree with what the report actually prints.
 *
 * Its whole value is that a flagged assignment really would come out with a
 * blank in it. Flag a field the report fills from a fallback and people learn
 * to ignore the warning, at which point it is worse than not having one.
 */
import { describe, it, expect } from 'vitest';
import { missingBolpatraFields, isBolpatraComplete } from '../src/utils/bolpatraGaps.js';

/** An assignment with nothing missing. */
const complete = () => ({
  id: 1, fy: '2081/82', assignmentName: 'Skills for Employment',
  clientId: 1, contractValue: '2500000',
  startDate: '2082/01/15', endDate: '2082/04/10',
  durationMonths: '3', totalPersonMonths: '12', staffCount: '4',
  isJV: false,
  descriptionOfWork: 'Delivered training.',
  narrativeDescription: 'Project narrative.',
  actualServicesDescription: 'Services provided.',
  seniorStaffDescription: 'Jane Doe — Team Leader.',
  occupations: [{ trainees: '40', locations: [{ district: 'Kathmandu' }] }],
});

/** A firm with all three narrative templates assigned. */
const withTemplates = { descTemplateId: 'V13', narrativeTemplateId: 'N13', servicesTemplateId: 'S13' };
const noTemplates = {};

const keys = (exp, inst) => missingBolpatraFields(exp, inst).map(g => g.key).sort();

describe('bolpatra gap detection', () => {
  it('reports nothing for a complete assignment', () => {
    expect(missingBolpatraFields(complete(), noTemplates)).toEqual([]);
    expect(isBolpatraComplete(complete(), noTemplates)).toBe(true);
  });

  it('reports each genuinely blank field', () => {
    const e = complete();
    e.assignmentName = ''; e.contractValue = ''; e.totalPersonMonths = '';
    expect(keys(e, noTemplates)).toEqual(['assignmentName', 'contractValue', 'totalPersonMonths']);
  });

  describe('does not flag what the report fills for itself', () => {
    it('country, which defaults to Nepal', () => {
      const e = complete(); e.country = '';
      expect(keys(e, noTemplates)).toEqual([]);
    });

    it('ownServiceValue, which falls back to the contract value', () => {
      const e = complete(); e.ownServiceValue = '';
      expect(keys(e, noTemplates)).toEqual([]);
    });

    it('durationMonths, when both contract dates are present', () => {
      const e = complete(); e.durationMonths = '';
      expect(keys(e, noTemplates)).toEqual([]);
    });

    it('JV partner fields on a non-JV assignment', () => {
      const e = complete();
      e.isJV = false; e.jvPartnerNames = ''; e.jvPartnerPersonMonths = '';
      expect(keys(e, noTemplates)).toEqual([]);
    });

    it('narratives, when the firm has a template assigned', () => {
      const e = complete();
      e.descriptionOfWork = ''; e.narrativeDescription = ''; e.actualServicesDescription = '';
      expect(keys(e, withTemplates)).toEqual([]);
      // …but the same assignment for a firm with no template is three gaps.
      expect(keys(e, noTemplates))
        .toEqual(['actualServicesDescription', 'descriptionOfWork', 'narrativeDescription']);
    });

    it('senior staff, when the firm has a key-staff roster set', () => {
      const e = complete(); e.seniorStaffDescription = '';
      const withRoster = { keyStaff: [{ name: 'Jane Doe', position: 'Team Leader' }] };
      expect(keys(e, withRoster)).toEqual([]);
      // …but the same assignment for a firm with no roster is a gap.
      expect(keys(e, noTemplates)).toEqual(['seniorStaffDescription']);
      // An empty roster counts the same as none.
      expect(keys(e, { keyStaff: [] })).toEqual(['seniorStaffDescription']);
    });
  });

  describe('flags what the report cannot fill', () => {
    it('durationMonths when the dates are missing too', () => {
      const e = complete();
      e.durationMonths = ''; e.startDate = ''; e.endDate = '';
      expect(keys(e, noTemplates)).toEqual(['dates', 'durationMonths', 'endDate']);
    });

    it('JV partner fields on a joint venture', () => {
      const e = complete();
      e.isJV = true; e.jvPartnerNames = ''; e.jvPartnerPersonMonths = '';
      expect(keys(e, noTemplates)).toEqual(['jvPartnerNames', 'jvPartnerPersonMonths']);
    });

    it('a district, whether it is absent or blank', () => {
      const e = complete(); e.occupations = [{ trainees: '40', locations: [] }];
      expect(keys(e, noTemplates)).toEqual(['location']);
      const f = complete(); f.occupations = [];
      expect(keys(f, noTemplates)).toEqual(['location']);
    });

    it('a client given by neither id nor manual name', () => {
      const e = complete(); e.clientId = null; e.clientName = '';
      expect(keys(e, noTemplates)).toEqual(['client']);
      // A manual client name is enough.
      const f = complete(); f.clientId = null; f.clientName = 'Ad-hoc Municipality';
      expect(keys(f, noTemplates)).toEqual([]);
    });

    it('staffCount, which has no fallback', () => {
      const e = complete(); e.staffCount = '';
      expect(keys(e, noTemplates)).toEqual(['staffCount']);
    });
  });

  it('treats whitespace as blank but keeps a real zero', () => {
    const e = complete(); e.totalPersonMonths = '   ';
    expect(keys(e, noTemplates)).toContain('totalPersonMonths');
    const f = complete(); f.contractValue = 0;
    expect(keys(f, noTemplates)).not.toContain('contractValue');
  });

  it('marks the narrative fields as long-form so the editor uses a textarea', () => {
    const e = complete();
    e.narrativeDescription = '';
    const gap = missingBolpatraFields(e, noTemplates).find(g => g.key === 'narrativeDescription');
    expect(gap.long).toBe(true);
    expect(gap.field).toBe('narrativeDescription');
  });

  it('separates fields the quick-fill form can edit from those it cannot', () => {
    const e = complete();
    e.clientId = null; e.clientName = ''; e.occupations = []; e.totalPersonMonths = '';
    const gaps = missingBolpatraFields(e, noTemplates);
    expect(gaps.filter(g => g.field).map(g => g.key)).toEqual(['totalPersonMonths']);
    expect(gaps.filter(g => !g.field).map(g => g.key).sort()).toEqual(['client', 'location']);
  });

  it('survives a null assignment', () => {
    expect(missingBolpatraFields(null, noTemplates)).toEqual([]);
  });
});
