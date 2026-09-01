/**
 * The Word export merges the same cells the print sheet does.
 *
 * Word does not have an HTML rowspan. It keeps the covered cell and marks it
 * `<w:vMerge w:val="continue"/>`, with `restart` on the first — so the two
 * renderers express the same table in opposite ways, and a mistake in the Word
 * one is invisible everywhere except inside the downloaded file. That is the
 * one output nobody checks until it is in front of a client.
 *
 * So this opens the generated .docx and reads the table XML.
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

let saved = null;
vi.mock('file-saver', () => ({ saveAs: (blob) => { saved = blob; } }));

const { default: bagmati } = await import('../src/reports/bagmati.jsx');

const occupations = [
  { id: 1, name: 'Barista' },
  { id: 2, name: 'Beautician' },
  { id: 3, name: 'Mobile Phone Repair' },
];
const clients = [{ id: 1, fullName: 'Province Youth Council Bagmati', shortName: 'PYC' }];
const occ = (id, trainees) => ({ id: `o${id}`, ctevtOccupationId: id, nameInLetter: '',
  trainees: String(trainees), duration: '390', locations: [] });

const MULTI = {
  id: 1, fy: '2083/84', assignmentName: 'Skill Development Training to youths in Bagmati Province',
  clientId: 1, contractValue: '2612870', startDate: '2083/01/02', endDate: '2083/03/30',
  occupations: [occ(1, 80), occ(3, 60), occ(2, 40)],
};
const SINGLE = {
  id: 2, fy: '2083/84', assignmentName: 'Vocational and Skill Development Training',
  clientId: 1, contractValue: '840580', startDate: '2082/05/01', endDate: '2082/10/23',
  occupations: [occ(1, 15)],
};

/** Generate the .docx and return word/document.xml. */
async function documentXml(exps) {
  saved = null;
  await bagmati.downloadDOCX(
    { id: 1, name: 'Test Firm', experience: exps, taxClearance: [] },
    exps, 'b1',
    { clients, occupations, portfolioFromFY: '', portfolioToFY: '' });
  expect(saved, 'nothing was handed to the file saver').toBeTruthy();
  const zip = await JSZip.loadAsync(await saved.arrayBuffer());
  return zip.file('word/document.xml').async('string');
}

/** The <w:tr> blocks, in order. */
const rowsOf = (xml) => xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
const cellsOf = (row) => row.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
// <w:t ...> only — `<w:t[^>]*>` also swallows <w:tcPr> and <w:tcBorders>.
const textOf = (cell) => [...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('');

describe('the generated .docx', () => {
  it('is a real Word file', async () => {
    const xml = await documentXml([MULTI]);
    expect(xml).toContain('<w:document');
    expect(xml).toContain('Skill Development Training to youths in Bagmati Province');
  });

  it('keeps a row per occupation', async () => {
    const xml = await documentXml([MULTI]);
    // One header row plus three occupation rows.
    expect(rowsOf(xml)).toHaveLength(4);
  });

  it('keeps every cell present in the merged rows, unlike the HTML', async () => {
    // Dropping them the way an HTML rowspan does would shift the columns.
    const rows = rowsOf(await documentXml([MULTI]));
    for (const r of rows) expect(cellsOf(r)).toHaveLength(8);
  });

  it('marks the assignment columns restart-then-continue', async () => {
    const rows = rowsOf(await documentXml([MULTI]));
    const merged = (row) => cellsOf(row).map(c =>
      /w:vMerge[^>]*w:val="restart"/.test(c) ? 'restart'
        : /<w:vMerge(?![^>]*w:val)/.test(c) || /w:vMerge[^>]*w:val="continue"/.test(c) ? 'continue'
        : 'plain');
    // Header row is untouched; body rows carry the merge on the six
    // assignment-level columns and leave Occupation and Trainees alone.
    expect(merged(rows[1])).toEqual(
      ['restart', 'restart', 'plain', 'plain', 'restart', 'restart', 'restart', 'restart']);
    for (const r of [rows[2], rows[3]]) {
      expect(merged(r)).toEqual(
        ['continue', 'continue', 'plain', 'plain', 'continue', 'continue', 'continue', 'continue']);
    }
  });

  it('writes the contract amount once', async () => {
    // The whole point: three cells showing it read as three contracts.
    const xml = await documentXml([MULTI]);
    expect(xml.split('26,12,870').length - 1).toBe(1);
  });

  it('leaves the continuation cells empty', async () => {
    // Text inside a continuation shows up under the merged value in Word.
    const rows = rowsOf(await documentXml([MULTI]));
    const later = cellsOf(rows[2]);
    expect(textOf(later[0])).toBe('');   // S.N.
    expect(textOf(later[1])).toBe('');   // Assignment name
    expect(textOf(later[2])).toBe('Mobile Phone Repair');
    expect(textOf(later[3])).toBe('60');
  });

  it('does not merge a single-occupation assignment', async () => {
    const rows = rowsOf(await documentXml([SINGLE]));
    expect(rows).toHaveLength(2);
    for (const c of cellsOf(rows[1])) expect(c).not.toMatch(/w:vMerge/);
  });
});
