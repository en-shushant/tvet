/**
 * A letter written from scratch: what goes on the page, and that typed text is shown, never run.
 */
import { describe, it, expect } from 'vitest';
import { esc, bodyHtml, buildLetterHtml, composeWritten, BLANK_LETTER } from '../src/utils/writtenLetter.js';

const assets = {
  letterhead: 'data:image/png;base64,AAAA', sign: 'data:image/png;base64,BBBB', stamp: 'data:image/png;base64,CCCC', kalimatiCss: '',
  margins: { top: 46, bottom: 30, lr: 20 }, stampScale: 1.5, signScale: 0.8,
  firmName: 'ZZ संस्था', contact: 'परीक्षण व्यक्ति', firmLabel: 'ZZL',
};
const letter = (over = {}) => ({ ...BLANK_LETTER, date: '२५ पुस २०८१', office: 'नमूना कार्यालय', subject: 'अनुरोध', body: 'पहिलो अनुच्छेद\nदोस्रो पङ्क्ति\n\nदोस्रो अनुच्छेद', ...over });

describe('written letter', () => {
  it('escapes what is typed', () => {
    expect(esc('<script>alert("x")</script> & \'q\'')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;q&#39;');
    const html = bodyHtml(assets, letter({ subject: '<img src=x onerror=1>', office: '<b>O</b>', body: '<i>hi</i>' }));
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>O</b>');
    expect(html).toContain('&lt;img src=x onerror=1&gt;');
  });

  it('puts the office on top, then the subject, then the body in paragraphs', () => {
    const html = bodyHtml(assets, letter({ addressee: 'श्री कार्यालय प्रमुख ज्यू,', address: 'काठमाडौं' }));
    expect(html.indexOf('श्री कार्यालय प्रमुख ज्यू,')).toBeLessThan(html.indexOf('नमूना कार्यालय'));
    expect(html.indexOf('नमूना कार्यालय')).toBeLessThan(html.indexOf('विषय: अनुरोध'));
    expect(html.indexOf('विषय: अनुरोध')).toBeLessThan(html.indexOf('पहिलो अनुच्छेद'));
    expect(html.match(/class="body-txt"/g)).toHaveLength(2);        // a blank line starts a new paragraph
    expect(html).toContain('पहिलो अनुच्छेद<br>दोस्रो पङ्क्ति');        // a single line break stays one
  });

  it('leaves out what is blank', () => {
    const html = bodyHtml(assets, { ...BLANK_LETTER, withSign: false, withStamp: false });
    expect(html).not.toContain('class="to-block"');
    expect(html).not.toContain('class="subject"');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('Signature');
    expect(html).not.toContain('Stamp');
  });

  it('draws the table only when it is on and has something in it, dropping empty rows', () => {
    const t = { on: true, cols: ['क्र.सं.', 'विवरण'], rows: [['१', 'पहिलो'], ['', ''], ['३', 'तेस्रो']] };
    const html = bodyHtml(assets, letter({ table: t }));
    expect(html).toContain('<th>क्र.सं.</th><th>विवरण</th>');
    expect(html.match(/<tr><td>/g)).toHaveLength(2);
    expect(bodyHtml(assets, letter({ table: { ...t, on: false } }))).not.toContain('<table');
    expect(bodyHtml(assets, letter({ table: { on: true, cols: ['', ''], rows: [['', '']] } }))).not.toContain('<table');
  });

  it('shows the signature and stamp only when chosen and available, with the signer beneath', () => {
    const on = bodyHtml(assets, letter({ signatory: 'ज्ञान कुमार', designation: 'निर्देशक' }));
    expect(on).toContain('alt="Signature"');
    expect(on).toContain('alt="Stamp"');
    expect(on).toContain('ज्ञान कुमार<br>निर्देशक<br>ZZ संस्था');
    const off = bodyHtml(assets, letter({ withSign: false, withStamp: false }));
    expect(off).not.toContain('alt="Signature"');
    expect(off).not.toContain('alt="Stamp"');
    expect(bodyHtml({ ...assets, sign: null, stamp: null }, letter())).not.toContain('<img');
    expect(bodyHtml(assets, letter())).toContain('परीक्षण व्यक्ति');   // the firm's contact person when no name is typed
  });

  it('follows the firm’s saved design: margins and the stamp and signature sizes', () => {
    const html = buildLetterHtml(assets, letter());
    expect(html).toContain('padding:46mm 20mm 30mm 20mm');
    expect(html).toContain('--stamp:1.5; --sign:0.8');
    expect(html).toContain('<div class="fit">');
    // the PDF draws the letterhead itself, so the page is transparent there and shows it only in the preview
    expect(buildLetterHtml(assets, letter())).toContain('background-color:transparent');
    expect(buildLetterHtml(assets, letter(), { preview: true })).toContain('background-image:url("data:image/png;base64,AAAA")');
  });

  it('is ready for the PDF renderer without attachments', () => {
    const c = composeWritten(assets, letter({ withStamp: false }));
    expect(c).toMatchObject({ useLhBg: true, includeSign: true, includeStamp: false, activeDocs: [], margins: assets.margins, stampScale: 1.5, signScale: 0.8 });
    expect(composeWritten(assets, letter({ withLetterhead: false })).useLhBg).toBe(false);
  });
});
