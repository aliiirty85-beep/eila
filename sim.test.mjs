/* شبیه‌سازی موتور ضرب‌الاجل و بلوک خودکار — فقط برای بررسی، در تست رسمی نیست */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('app.js', 'utf8');
const dom = new JSDOM(html, { url: 'https://example.com/eila/', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.scrollTo = () => {};
window.eval(js);
const E = window.__eila;
const d = window.document;

const TEH = 210 * 60000; // آفست ثابت تهران +۳:۳۰ (سال ۲۰۲۶)
const T = (y, m, dd, hh, mm) => Date.UTC(y, m - 1, dd, hh, mm) - TEH;
let fails = 0;
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) fails++; };

/* ─── ضرب‌الاجل روزانه ۲۲:۰۰ ─── */
const acts = E.state().activities;
const daily = { name: 'D', icon: '🎯', level: 1, deadline: { type: 'daily', time: '22:00', weekday: 5, day: 1 } };
const weekly = { name: 'W', icon: '🎯', level: 1, deadline: { type: 'weekly', time: '18:00', weekday: 6, day: 1 } }; // شنبه
const monthly = { name: 'M', icon: '🎯', level: 1, deadline: { type: 'monthly', time: '09:00', weekday: 5, day: 31 } };

let nd = E.nextDueFor(daily, T(2026, 11, 21, 10, 0)); // شنبه ۲۱ آبان ساعت ۱۰
ok('daily: next due today 22:00', nd === T(2026, 11, 21, 22, 0));
nd = E.nextDueFor(daily, T(2026, 11, 21, 23, 0));
ok('daily: after 22:00 → tomorrow', nd === T(2026, 11, 22, 22, 0));
let pd = E.prevDueFor(daily, T(2026, 11, 21, 23, 0));
ok('daily: prev due today 22:00', pd === T(2026, 11, 21, 22, 0));

/* ۲۱ آبان ۲۰۲۶ = شنبه (ایرانی) → weekday=6 */
nd = E.nextDueFor(weekly, T(2026, 11, 21, 10, 0));
ok('weekly: same Saturday 18:00', nd === T(2026, 11, 21, 18, 0));
nd = E.nextDueFor(weekly, T(2026, 11, 21, 19, 0));
ok('weekly: past 18:00 → next Saturday', nd === T(2026, 11, 28, 18, 0));

nd = E.nextDueFor(monthly, T(2026, 11, 20, 10, 0));
ok('monthly day=31: Nov has 30 → Nov 30', nd === T(2026, 11, 30, 9, 0));
nd = E.nextDueFor(monthly, T(2026, 11, 30, 10, 0));
ok('monthly day=31: past → Dec 31', nd === T(2026, 12, 31, 9, 0));
nd = E.nextDueFor(monthly, T(2027, 1, 31, 10, 0));
ok('monthly day=31: past Jan31 → Feb clamp 28', nd === T(2027, 2, 28, 9, 0));

/* ─── ثبت خودکار بلوک‌ها و امتیاز خیام ─── */
// شروع جلسه دستی: مستقیم session را تنظیم می‌کنیم (joinBlocks در jsdom بدون رویداد)
const state1 = E.state();
state1.session.active = false;

// creditToBlock: ۱۰ امتیاز فعالیت لول ۳ (دفعهٔ ۳) + ۱۰ امتیاز بلوک لول ۲ (دفعهٔ ۴) = ۲۰ در یک بلوک
const now = Date.now();
const bs = E.blockStartAt(now);
E.creditToBlock(now, { kind: 'activity', actId: 'x1', name: 'فعالیت لول۳', icon: '🎯', level: 3, k: 3, pts: 6, ts: now });
E.creditToBlock(now + 1, { kind: 'activity', actId: 'x1', name: 'فعالیت لول۳', icon: '🎯', level: 3, k: 4, pts: 10, ts: now + 1 });
E.creditToBlock(now + 2, { kind: 'block', actId: 'block5', name: 'بلوک', icon: '⏱', level: 2, k: 4, pts: 4, ts: now + 2 });
const st2 = E.state();
const rec = st2.blocks[String(bs)];
ok('block record total = 20 (10+10)', rec && rec.total === 20);
ok('total points updated', st2.points === 20);

/* ─── sealBlock: امتیاز خود بلوک با لول ۲ ─── */
const before = E.state().counts['block5'] || 0;
E.sealBlock(bs - 300000); // بلوک قبلی
const st3 = E.state();
ok('sealBlock incremented block count', st3.counts['block5'] === before + 1);
const prevRec = st3.blocks[String(bs - 300000)];
ok('previous block record created with its own points', !!prevRec && prevRec.credits.some(c => c.kind === 'block'));

/* ─── هم‌ترازی مضرب ۵ دقیقه تهران ─── */
const start = E.blockStartAt(T(2026, 11, 21, 14, 7));
ok('block start aligned to Tehran 14:05', T(2026, 11, 21, 14, 5) === start);

dom.window.close();
console.log(fails ? 'SIMULATION FAILED' : 'SIMULATION OK');
process.exit(fails ? 1 : 0);
