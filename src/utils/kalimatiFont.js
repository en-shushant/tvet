let _cache;

export async function loadKalimatiCss() {
  if (typeof _cache === 'string') return _cache;
  try {
    // Load from the locally-bundled font file — no Google Fonts dependency,
    // no CORS risk, works offline and inside srcdoc iframes.
    const res = await fetch('/fonts/kalimati.woff2');
    if (res.ok) {
      const arr = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < arr.length; i += 8192)
        bin += String.fromCharCode(...arr.subarray(i, i + 8192));
      // font-display:block — Safari must not paint with a fallback in srcdoc
      // iframes and then skip the repaint once the data-URI font is ready.
      _cache = `@font-face{font-family:'Kalimati';font-display:block;src:url('data:font/woff2;base64,${btoa(bin)}') format('woff2');}`;
      return _cache;
    }
  } catch {}
  return '';
}
