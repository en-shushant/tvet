export const BS_MONTHS = ['बैशाख','जेठ','असार','साउन','भदौ','असोज','कार्तिक','मंसिर','पुस','माघ','फाल्गुन','चैत'];
// Romanised Bikram Sambat months, for English-language documents such as the
// Standard EOI form where dates are still BS but the paperwork is in English.
export const BS_MONTHS_EN = ['Baishakh','Jestha','Ashadh','Shrawan','Bhadra','Ashwin',
                             'Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
export const BS_DAYS   = ['आइतबार','सोमबार','मंगलबार','बुधबार','बिहीबार','शुक्रबार','शनिबार'];
export const NP_DIGITS = ['०','१','२','३','४','५','६','७','८','९'];
export const toNpNum   = n => String(n).split('').map(d=>NP_DIGITS[+d]||d).join('');

// Accurate month lengths per BS year (index 0 = Baisakh)
// Verified against Nepal government calendar
export const BS_DATA = {
  2080:[31,32,31,32,31,30,30,30,29,29,30,30], // 2080/01/01 = 2023/04/14
  2081:[31,31,32,32,31,30,30,30,29,30,30,30], // 2081/01/01 = 2024/04/13
  2082:[31,31,32,32,31,30,30,30,29,30,29,31], // 2082/01/01 = 2025/04/13
  2083:[31,31,32,31,31,31,30,30,29,30,30,30], // 2083/01/01 = 2026/04/13
  2084:[31,31,32,31,31,30,30,30,29,30,30,30],
  2085:[31,32,31,32,31,30,30,30,29,30,30,30],
  2086:[31,32,31,32,31,30,30,30,29,30,29,31],
};

// Reference: BS 2083/01/01 = AD 2026/04/14 (UTC)
export const BS_REF = { bs:{y:2083,m:1,d:1}, ad: new Date(Date.UTC(2026,3,14)) };

export function adToBS(adUtcDate) {
  let days = Math.round((adUtcDate - BS_REF.ad) / 86400000);
  let y = BS_REF.bs.y, m = 1, d = 1;
  if (days >= 0) {
    outer: for(;;) {
      const months = BS_DATA[y];
      if(!months) break;
      for(let mi=0; mi<12; mi++) {
        const len = months[mi];
        if(days < len) { m=mi+1; d=days+1; break outer; }
        days -= len;
      }
      y++;
    }
  } else {
    // go backwards
    days = -days - 1;
    outer: for(;;) {
      if(y <= 2079) break;
      y--;
      const months = BS_DATA[y];
      if(!months) break;
      for(let mi=11; mi>=0; mi--) {
        const len = months[mi];
        if(days < len) { m=mi+1; d=len-days; break outer; }
        days -= len;
      }
    }
  }
  return {y,m,d};
}

export function bsToAD(y, m, d) {
  // count days from BS_REF (2083/01/01) to target
  let days = 0;
  if (y > BS_REF.bs.y || (y === BS_REF.bs.y && m > 1) || (y === BS_REF.bs.y && m === 1 && d >= 1)) {
    // count forward
    let cy = BS_REF.bs.y, cm = 1, cd = 1;
    while (cy < y || cm < m || cd < d) {
      const months = BS_DATA[cy];
      if (!months) break;
      const maxD = months[cm - 1];
      if (cy === y && cm === m && cd === d) break;
      cd++;
      days++;
      if (cd > maxD) { cd = 1; cm++; }
      if (cm > 12) { cm = 1; cy++; }
    }
  } else {
    // count backward from ref
    let cy = BS_REF.bs.y, cm = 1, cd = 1;
    while (cy > y || cm > m || cd > d) {
      cd--;
      days--;
      if (cd < 1) {
        cm--;
        if (cm < 1) { cm = 12; cy--; }
        const months = BS_DATA[cy];
        cd = months ? months[cm - 1] : 30;
      }
    }
  }
  const adDate = new Date(BS_REF.ad.getTime() + days * 86400000);
  const yy = adDate.getUTCFullYear();
  const mm = String(adDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(adDate.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
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
