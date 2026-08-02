// Fetches Kalimati from Google Fonts and returns an inline @font-face CSS string
// with the font embedded as a base64 data URI. Cached after the first call so
// subsequent letters in the same session cost nothing. This is the only reliable
// way to get a Devanagari font into a srcdoc iframe — Google Fonts <link> tags
// don't load in null-origin contexts.
let _cache;

export async function loadKalimatiCss() {
  if (_cache !== undefined) return _cache;
  try {
    const cssRes = await fetch(
      'https://fonts.googleapis.com/css2?family=Kalimati&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    );
    const css = await cssRes.text();
    const m = css.match(/url\(([^)]+)\)/);
    if (m) {
      const fontRes = await fetch(m[1]);
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
