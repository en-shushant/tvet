import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { wordBefore } from '../src/components/ui/NepaliInput.jsx';
const require = createRequire(import.meta.url);
const { suggest } = require('../backend/lib/transliterate.js');

describe('Nepali typing', () => {
  it('finds the Latin word before the caret', () => {
    expect(wordBefore('नमस्ते kath', 11)).toEqual({ word: 'kath', start: 7 });
    expect(wordBefore('नमस्ते ', 7)).toBeNull();
    expect(wordBefore('abc 12', 6)).toBeNull();
  });
  it('reads Google Input Tools replies and ignores anything else', async () => {
    const ok = async () => ({ ok: true, json: async () => ['SUCCESS', [['namaste', ['नमस्ते', 'नमस्ते२'], [], {}]]] });
    expect(await suggest('namaste', ok)).toEqual(['नमस्ते', 'नमस्ते२']);
    expect(await suggest('x y', ok)).toEqual([]);
    expect(await suggest('नेपाल', ok)).toEqual([]);
    expect(await suggest('broken', async () => { throw new Error('down'); })).toEqual([]);
    expect(await suggest('failed', async () => ({ ok: true, json: async () => ['FAILED'] }))).toEqual([]);
  });
});
