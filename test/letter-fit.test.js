/**
 * One page only: the writing between the margins is scaled to fit, and the margins themselves are left alone.
 * jsdom does no layout, so the writing's height is stubbed: constant, whatever the width.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fitLetter } from '../src/utils/neaLetter.js';

const MM_PX = 96 / 25.4;
const A4_H = 1123;

function page(height, { sig = false } = {}) {
  document.body.innerHTML = `<div class="page"><div class="page-inner"><div class="fit">${sig ? '<div class="sig-row"></div>' : ''}</div></div></div>`;
  const fit = document.querySelector('.fit');
  Object.defineProperty(fit, 'offsetHeight', { configurable: true, get: () => height - (fit.querySelector('.sig-row')?.style.marginTop ? 72 - parseInt(fit.querySelector('.sig-row').style.marginTop, 10) : 0) });
  return { doc: document, fit, inner: document.querySelector('.page-inner') };
}

describe('fitLetter', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('leaves a letter that already fits at full size', () => {
    const { doc, fit } = page(700);
    const r = fitLetter(doc, { topMm: 40, bottomMm: 25, lrMm: 20 });
    expect(r).toMatchObject({ scale: 1, fits: true });
    expect(fit.style.transform).toBe('');
  });

  it('scales only the writing, to the height between the margins', () => {
    const { doc, fit, inner } = page(1000);
    const r = fitLetter(doc, { topMm: 60, bottomMm: 40, lrMm: 15 });
    const avail = A4_H - 100 * MM_PX;
    expect(r.fits).toBe(true);
    expect(r.scale).toBeLessThan(1);
    expect(1000 * r.scale).toBeLessThanOrEqual(avail + 0.5);
    expect(1000 * r.scale).toBeGreaterThan(avail - 8);          // the largest size that fits, not merely a smaller one
    expect(fit.style.transform).toBe(`scale(${r.scale})`);
    // The margins are not scaled with the writing.
    expect([inner.style.paddingTop, inner.style.paddingRight, inner.style.paddingBottom, inner.style.paddingLeft])
      .toEqual(['60mm', '15mm', '40mm', '15mm']);
    expect(inner.style.transform).toBe('');
  });

  it('shrinks smaller as the margins grow, and larger as they shrink', () => {
    const a = fitLetter(page(1000).doc, { topMm: 20, bottomMm: 15, lrMm: 20 });
    const b = fitLetter(page(1000).doc, { topMm: 70, bottomMm: 50, lrMm: 20 });
    expect(b.scale).toBeLessThan(a.scale);
  });

  it('says so when even the smallest size is too long', () => {
    const { doc } = page(5000);
    const r = fitLetter(doc, { topMm: 40, bottomMm: 25, lrMm: 20 });
    expect(r.fits).toBe(false);
    expect(r.scale).toBe(0.4);
  });

  it('closes up the signature gap before scaling anything', () => {
    // 72px of gap to give: 1100 is too tall for a 40/25 mm page, 1100 - 64 is not.
    const { doc, fit } = page(1100, { sig: true });
    const avail = A4_H - 65 * MM_PX;
    expect(1100).toBeGreaterThan(avail);
    const r = fitLetter(doc, { topMm: 40, bottomMm: 25, lrMm: 20 });
    if (r.scale === 1) expect(fit.style.transform).toBe('');
    expect(r.fits).toBe(true);
  });
});
