// Fetches Kalimati from Google Fonts and returns an inline @font-face CSS string
// with the font embedded as a base64 data URI. Cached after the first call so
// subsequent letters in the same session cost nothing. This is the only reliable
// way to get a Devanagari font into a srcdoc iframe — Google Fonts <link> tags
// don't load in null-origin contexts.
//
// A 5-second abort timeout prevents this from hanging the PDF generation flow
// when Google Fonts is slow or unreachable; the fallback is an empty string
// (system sans-serif renders instead of Kalimati).
let _cache;

export async function loadKalimatiCss() {
  if (_cache !== undefined) return _cache;
  try {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 5000);
    let cssRes;
    try {
      cssRes = await fetch(
        'https://fonts.googleapis.com/css2?family=Kalimati&display=swap',
        { signal: abort.signal }
      );
    } finally {
      clearTimeout(timer);
    }
    const css = await cssRes.text();
    const m = css.match(/url\(([^)]+)\)/);
    if (m) {
      const abort2 = new AbortController();
      const timer2 = setTimeout(() => abort2.abort(), 10000);
      let fontRes;
      try {
        fontRes = await fetch(m[1], { signal: abort2.signal });
      } finally {
        clearTimeout(timer2);
      }
      if (fontRes.ok) {
        const arr = new Uint8Array(await fontRes.arrayBuffer());
        let bin = '';
        for (let i = 0; i < arr.length; i += 8192)
          bin += String.fromCharCode(...arr.subarray(i, i + 8192));
        const fmt = m[1].includes('.woff2') ? 'woff2' : 'woff';
        _cache = `@font-face{font-family:'Kalimati';src:url('data:font/${fmt};base64,${btoa(bin)}')format('${fmt}');}`;
        return _cache;
      }
    }
  } catch {}
  _cache = '';
  return '';
}
