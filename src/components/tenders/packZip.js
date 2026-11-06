import JSZip from 'jszip';

/** One zip from named files ({ name, blob|text }). Names are kept as given, de-duplicated if repeated. */
export async function buildPackZip(files) {
  const zip = new JSZip();
  const used = new Set();
  for (const f of files) {
    let name = String(f.name).replace(/[\\/:*?"<>|]/g, '_');
    while (used.has(name)) name = name.replace(/(\.[^.]*)?$/, (m) => ` (2)${m || ''}`);
    used.add(name);
    zip.file(name, f.blob || f.text || '');
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
