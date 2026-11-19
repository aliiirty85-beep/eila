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

const checks = {
  'header shows level': d.querySelector('#levelChip').textContent.includes('مبتدی'),
  '6 activity chips': d.querySelectorAll('#activityChips .chip').length === 6,
  '6 activity cards': d.querySelectorAll('#actsList .act-card').length === 6,
  'clock at 05:00': d.querySelector('#timeDisplay').textContent === '۰۵:۰۰',
  'ring initialised': !!d.querySelector('#ringFg').style.strokeDasharray,
  'install status filled': d.querySelector('#installStatus').textContent !== '…',
  'install hint filled': d.querySelector('#installHint').textContent.length > 10,
  'install btn hidden w/o prompt': d.querySelector('#btnInstall').classList.contains('hidden')
};

// مرورگر پیام نصب را بدهد → دکمه ظاهر شود
const ev = new window.Event('beforeinstallprompt');
Object.defineProperty(ev, 'preventDefault', { value: () => {} });
window.dispatchEvent(ev);
checks['install btn shown after prompt'] = !d.querySelector('#btnInstall').classList.contains('hidden');

// شروع / توقف موقت تایمر
d.querySelector('#btnStart').click();
await new Promise(r => setTimeout(r, 30)); // startTimer async است
checks['pause button appears on start'] = !d.querySelector('#btnPause').classList.contains('hidden');
checks['start button hidden on start'] = d.querySelector('#btnStart').classList.contains('hidden');
d.querySelector('#btnPause').click();
checks['pause -> resume label'] = d.querySelector('#btnPause').textContent.includes('ادامه');

for (const [k, v] of Object.entries(checks)) console.log(`${v ? 'PASS' : 'FAIL'}  ${k}`);
if (errors.length) console.log('JS ERRORS:\n' + errors.join('\n'));
dom.window.close();
const failed = Object.values(checks).some(v => !v) || errors.length > 0;
console.log(failed ? 'SMOKE TEST FAILED' : 'SMOKE TEST OK');
process.exit(failed ? 1 : 0);
