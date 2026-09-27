import NepaliDateModule from 'nepali-date-converter';
// The package is CommonJS: bundlers unwrap its default export, plain Node does not.
const NepaliDate = NepaliDateModule.default || NepaliDateModule;
export const BS_MONTHS = ['बैशाख','जेठ','असार','साउन','भदौ','असोज','कार्तिक','मंसिर','पुस','माघ','फाल्गुन','चैत'];
// Romanised Bikram Sambat months, for English-language documents such as the
// Standard EOI form where dates are still BS but the paperwork is in English.
export const BS_MONTHS_EN = ['Baishakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin',
                             'Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
export const BS_DAYS   = ['आइतबार','सोमबार','मंगलबार','बुधबार','बिहीबार','शुक्रबार','शनिबार'];
export const NP_DIGITS = ['०','१','२','३','४','५','६','७','८','९'];
export const toNpNum   = n => String(n).split('').map(d=>NP_DIGITS[+d]||d).join('');

// ── Bikram Sambat calendar ──────────────────────────────────────────────────
// Month lengths come from nepali-date-converter (BS 2000–2089 complete), not a
// hand-typed table: the old table here covered only 2080–2086 and was a day
// early on real dates (it put New Year 2081 on 12 April 2024; it was the 13th).
// Checked against New Years 2080–2082 and Laxmi Puja 2081 — see test/nepali.test.js.

const pad = (n) => String(n).padStart(2, '0');
const localDate = (y, m, d) => new Date(y, m - 1, d);   // the package reads local date fields

/** Month lengths (index 0 = Baisakh) for every BS year the calendar covers. */
export const BS_DATA = (() => {
  const out = {};
  for (let y = 2000; y <= 2089; y++) {
    const starts = [];
    for (let m = 1; m <= 12; m++) starts.push(new NepaliDate(y, m - 1, 1).toJsDate());
    starts.push(new NepaliDate(y + 1, 0, 1).toJsDate());
    out[y] = starts.slice(0, 12).map((s, i) => Math.round((starts[i + 1] - s) / 86400000));
  }
  return out;
})();

// Reference: BS 2083/01/01 = AD 2026/04/14.
export const BS_REF = { bs: { y: 2083, m: 1, d: 1 }, ad: new Date(Date.UTC(2026, 3, 14)) };

/** AD date (read in UTC, as callers pass Date.UTC midnights) → { y, m, d } in BS. */
export function adToBS(adUtcDate) {
  const d = adUtcDate instanceof Date ? adUtcDate : new Date(adUtcDate);
  const nd = new NepaliDate(localDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  return { y: nd.getYear(), m: nd.getMonth() + 1, d: nd.getDate() };
}

/** BS year, month, day → "YYYY-MM-DD" in AD. */
export function bsToAD(y, m, d) {
  const js = new NepaliDate(Number(y), Number(m) - 1, Number(d)).toJsDate();
  return `${js.getFullYear()}-${pad(js.getMonth() + 1)}-${pad(js.getDate())}`;
}

export function getNepaliDate() {
  const now = new Date();
  // Get today's date in Kathmandu timezone as a clean UTC midnight
  const ktmStr = now.toLocaleDateString('en-CA', {timeZone:'Asia/Kathmandu'});
  const [y,mo,dy] = ktmStr.split('-').map(Number);
  const ktmMidnight = new Date(Date.UTC(y, mo-1, dy));
  const bs = adToBS(ktmMidnight);
  const dayIndex = ktmMidnight.getUTCDay();
  const enDate = ktmMidnight.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
  return {
    bs, dayIndex,
    npDay: BS_DAYS[dayIndex],
    npDate: `${toNpNum(bs.d)} ${BS_MONTHS[bs.m-1]} ${toNpNum(bs.y)}`,
    enDate,
    enDay: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayIndex],
  };
}

/**
 * Every Bikram Sambat year the calendar data covers, ascending.
 *
 * Was derived independently in Shortlisting.jsx and QuotationsView.jsx from the
 * same BS_DATA; a third copy was about to appear when the date picker moved to
 * its own module.
 */
export const BS_YEARS = Object.keys(BS_DATA).map(Number).sort((a, b) => a - b);
