/**
 * 4(A) Financial Capacity must match the printed EOI form.
 *
 * The form's structure is not ours to rearrange — an evaluator reads it
 * against the standard document. Three things had drifted:
 *
 *  - "4.  Capacity" is the parent heading that 4(A) sits *under*. It was being
 *    emitted inside the section body, so it printed after the 4(A) sub-heading
 *    and its note, and after the firm line.
 *  - The turnover table was set to roughly half the content width; on the form
 *    it spans the full text block.
 *  - "Average Annual Turnover" is a label printed beside the box, not inside a
 *    bordered cell of its own.
 */
import { describe, it, expect } from 'vitest';
import bolpatra from '../src/reports/bolpatra.jsx';

const inst = {
  id: 1, name: 'United Technical Training Educational Pvt. Ltd.',
  taxClearance: [
    { fy: '2079/80', turnover: 335781180 },
    { fy: '2080/81', turnover: 227194650 },
    { fy: '2081/82', turnover: 588179030 },
  ],
};

const html = (over = {}) =>
  bolpatra.buildPrintHTML(inst, [], [], '4a', null, { clients: [], ...over });

describe('4(A) print layout', () => {
  it('prints "4.  Capacity" above the 4(A) sub-heading, not below it', () => {
    const out = html();
    const capacity = out.indexOf('4.  Capacity');
    const subHead  = out.indexOf('4(A). Financial Capacity');
    const note     = out.indexOf('to be filled separately for each constituent member');
    expect(capacity).toBeGreaterThan(-1);
    expect(capacity, '"4. Capacity" must come first').toBeLessThan(subHead);
    expect(subHead).toBeLessThan(note);
  });

  it('keeps the parent heading above the firm line too', () => {
    // Multi-firm prints a "Lead firm:" line between the note and the body; the
    // parent heading must still be at the top, not after it.
    const out = bolpatra.buildMultiPrintHTML(
      [{ inst, exps: [] }, { inst: { id: 2, name: 'Partner Ltd.' }, exps: [] }],
      [], '4a', null, { clients: [] });
    const capacity = out.indexOf('4.  Capacity');
    expect(capacity).toBeLessThan(out.indexOf('4(A). Financial Capacity'));
    expect(capacity).toBeLessThan(out.indexOf('Lead firm'));
  });

  it('emits the parent heading once per section, not once per element', () => {
    const out = html();
    expect(out.split('4.  Capacity').length - 1).toBe(1);
  });

  it('gives the turnover table the full text width', () => {
    const out = html();
    expect(out).toMatch(/\.turnover\s*\{[^}]*width:\s*100%/);
    expect(out, 'the half-width cap was what made it look wrong')
      .not.toMatch(/\.turnover\s*\{[^}]*max-width/);
  });

  it('aligns the average box with the table above it', () => {
    const out = html();
    expect(out).toMatch(/\.avg\s*\{[^}]*width:\s*100%/);
    expect(out).not.toMatch(/\.avg\s*\{[^}]*max-width/);
  });

  it('leaves the average label outside the box', () => {
    const out = html();
    // The label is its own element, not a bordered table cell.
    expect(out).toContain('<div class="avg-label">');
    expect(out).toMatch(/\.avg-label\s*\{(?![^}]*border)[^}]*\}/);
  });

  it('still prints the figures and the average', () => {
    const out = html();
    expect(out).toContain('2079/80');
    expect(out).toContain('2081/82');
    // Mean of the three, rounded — the form asks for the average, not the sum.
    expect(out).toContain('Average Annual Turnover');
    expect(out).toContain('(Note: Supporting documents for Average Turnover should be submitted for the above.)');
  });

  it('does not put a stray parent heading on other sections', () => {
    for (const id of ['2', '3a', '3b', '3c']) {
      const out = bolpatra.buildPrintHTML(inst, [], [], id, null, { clients: [] });
      expect(out, `${id} should not carry "4. Capacity"`).not.toContain('4.  Capacity');
    }
  });
});
