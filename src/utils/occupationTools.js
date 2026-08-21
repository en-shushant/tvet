/**
 * Fetching an occupation's tools, including anything filed under "N/A".
 *
 * occupation_tools is keyed by occupation and level, and "N/A" means the list
 * is not level-specific — it applies whatever level the training runs at. Two
 * occupations in this registry hold their entire list that way (187 items
 * between them), so asking only for the chosen level returned nothing and the
 * schedule came out empty even though the tools existed.
 *
 * Kept in one place because five call sites fetch these lists — the 4(B)
 * picker, the ENSSURE D2/D3 lookup, and three paths in the Tools report — and
 * the rule has to be the same in all of them or a document disagrees with the
 * screen that configured it.
 */
import { api } from './api.js';

/** Tools for one occupation at `level`, merged with its level-agnostic ones. */
export async function fetchToolsFor(occId, level, token) {
  const get = (lvl) =>
    api('GET', `/occupation-tools/${occId}/${encodeURIComponent(lvl)}`, null, token)
      .then(d => (Array.isArray(d) ? d : []))
      .catch(() => []);

  if (!level || level === 'N/A') return get('N/A');

  const [atLevel, atNA] = await Promise.all([get(level), get('N/A')]);
  // Dedupe by id, in case a tool is ever filed under both.
  const seen = new Set(atLevel.map(t => t.id));
  return [...atLevel, ...atNA.filter(t => !seen.has(t.id))];
}

/**
 * Rows from GET /occupation-tools/counts for one occupation at one level,
 * counting the level-agnostic ones too, so "nothing here" on screen means the
 * same thing the fetch above would return.
 */
export function countToolsFor(countRows, occId, level) {
  if (!countRows || !level) return null;
  const at = (lvl) => countRows.find(
    r => String(r.occupation_id) === String(occId) && r.level === lvl
  )?.count || 0;
  return level === 'N/A' ? at('N/A') : at(level) + at('N/A');
}
