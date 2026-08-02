let _cache;

export async function loadKalimatiCss() {
  if (typeof _cache === 'string') return _cache;
  try {
    const cssAbort = new AbortController();
    const cssTimer = setTimeout(() => cssAbort.abort(), 5000);
    let cssRes;
    try {
      cssRes = await fetch(
        'https://fonts.googleapis.com/css2?family=Kalimati&display=swap',
        { signal: cssAbort.signal }
      );
    } finally { clearTimeout(cssTimer); }

    const css = await cssRes.text();
    // Strip surrounding quotes from the URL if Google Fonts includes them
    const m = css.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (m) {
      const fontAbort = new AbortController();
      const fontTimer = setTimeout(() => fontAbort.abort(), 10000);
      let fontRes;
      try {
        fontRes = await fetch(m[1], { signal: fontAbort.signal });
      } finally { clearTimeout(fontTimer); }

      if (fontRes.ok) {
        const arr = new Uint8Array(await fontRes.arrayBuffer());
        let bin = '';
        for (let i = 0; i < arr.length; i += 8192)
          bin += String.fromCharCode(...arr.subarray(i, i + 8192));
        const fmt = m[1].includes('.woff2') ? 'woff2' : 'woff';
        // Space before format() is required by the CSS spec
        _cache = `@font-face{font-family:'Kalimati';src:url('data:font/${fmt};base64,${btoa(bin)}') format('${fmt}');}`;
        return _cache;
      }
    }
  } catch {}
  // Don't cache failures — allow retry on the next letter generation
  return '';
}
