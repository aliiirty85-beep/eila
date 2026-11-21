import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');
const errors = [];
const dom = new JSDOM(html, {
  url: 'https://example.com/eila/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
const d = window.document;
window.addEventListener('error', e => errors.push(String(e.error || e.message)));
window.scrollTo = () => {};

try { window.eval(js); } catch (e) { errors.push(String(e.stack || e)); }

const E = window.__eila;
const checks = {
  /* مثلث خیام — قواعد امتیاز (مطابق خواستهٔ کاربر) */
  'khayam L2: 4th time = 4 points': E.khayamPoint(2, 4) === 4,
  'khayam L2: cumulative after 4 = 10': E.khayamCumul(2, 4) === 10,
  'khayam L3: 3rd time = 6 points': E.khayamPoint(3, 3) === 6,
  'khayam L3: cumulative after 3 = 10': E.khayamCumul(3, 3) === 10,
  'khayam L1: always 1 point': E.khayamPoint(1, 7) === 1,
  'khayam L4 seq 1,4,10,20': JSON.stringify(E.khayamSeq(4, 4)) === JSON.stringify([1, 4, 10, 20]),
  'block starts on Tehran 5-min multiple': E.blockStartAt(Date.now()) % 300000 === 0,

  /* رابط کاربری */
  'header shows level': d.querySelector('#levelChip').textContent.includes('مبتدی'),
  '5 activity chips (block5 excluded)': d.querySelectorAll('#activityChips .chip').length === 5,
  '6 activity cards': d.querySelectorAll('#actsList .act-card').length === 6,
  'block window label has Tehran marker': d.querySelector('#blockWindow').textContent.includes('ساعت تهران'),
  'ring initialised': !!d.querySelector('#ringFg').style.strokeDasharray,
  'khayam table rendered (8 levels)': d.querySelectorAll('#khayamTable .khy-row').length === 8,
  'block history empty state': d.querySelector('#blockHistory').textContent.includes('بلوکی ثبت نشده'),
  'form has level select': !!d.querySelector('#af-level'),
  'form has deadline type select': !!d.querySelector('#af-dl-type'),
  'install status filled': d.querySelector('#installStatus').textContent !== '…',
  'install hint filled': d.querySelector('#installHint').textContent.length > 10,
  'install btn hidden w/o prompt': d.querySelector('#btnInstall').classList.contains('hidden')
};

// مرورگر پیام نصب را بدهد → دکمه ظاهر شود
const ev = new window.Event('beforeinstallprompt');
Object.defineProperty(ev, 'preventDefault', { value: () => {} });
window.dispatchEvent(ev);
checks['install btn shown after prompt'] = !d.querySelector('#btnInstall').classList.contains('hidden');

// اعتبار امتیاز داخل بلوک ۵ دقیقه‌ای
const now = Date.now();
E.creditToBlock(now, { kind: 'activity', actId: 'x', name: 'تست', icon: '🎯', level: 3, k: 3, pts: 6, ts: now });
const st = E.state();
const key = String(E.blockStartAt(now));
checks['credit lands in current 5-min block'] = !!st.blocks[key] && st.blocks[key].total === 6;

// شروع / توقف موقت فعالیت (چیپ اول = مطالعه متمرکز)
d.querySelectorAll('#activityChips .chip')[0].click();
await new Promise(r => setTimeout(r, 30));
checks['activity timer started via chip'] = !!E.state().timer;
checks['running card visible'] = !d.querySelector('#actRunningCard').classList.contains('hidden');
d.querySelector('#btnPause').click();
checks['pause -> resume label'] = d.querySelector('#btnPause').textContent.includes('ادامه');

for (const [k, v] of Object.entries(checks)) console.log(`${v ? 'PASS' : 'FAIL'}  ${k}`);
if (errors.length) console.log('JS ERRORS:\n' + errors.join('\n'));
dom.window.close();
const failed = Object.values(checks).some(v => !v) || errors.length > 0;
console.log(failed ? 'SMOKE TEST FAILED' : 'SMOKE TEST OK');
process.exit(failed ? 1 : 0);
