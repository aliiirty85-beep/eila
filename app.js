'use strict';
/* ════════════════════════════════════════════════════════════
   ایلا — ضرب‌الاجل، امتیاز و سطح
   📐 امتیازدهی صرفاً از لول‌های مثلث خیام (پاسکال)
   🧱 بلوک ۵ دقیقه‌ای روی مضرب‌های ۵ دقیقهٔ ساعت تهران —
      شروع و پایان کاملاً خودکار
   ⏰ ضرب‌الاجل‌های روزانه / هفتگی / ماهانه با آلارم
   ════════════════════════════════════════════════════════════ */

/* ─────────── ابزارها ─────────── */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const fa = n => String(n).replace(/\d/g, d => FA_DIGITS[+d]);
const pad2 = n => String(n).padStart(2, '0');
const fmtClock = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return fa(Math.floor(s / 60)) + ':' + fa(pad2(s % 60));
};
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const FIVE_MIN = 5 * 60 * 1000;
const RING_C = 2 * Math.PI * 100; // محیط دایرهٔ حلقهٔ تایمر

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k)    { try { localStorage.removeItem(k); } catch (e) {} }
};

function timeAgo(ts) {
  const d = Date.now() - ts;
  if (d < 60e3)      return 'همین حالا';
  if (d < 3600e3)    return fa(Math.floor(d / 60e3)) + ' دقیقه پیش';
  if (d < 86400e3)   return fa(Math.floor(d / 3600e3)) + ' ساعت پیش';
  return fa(Math.floor(d / 86400e3)) + ' روز پیش';
}

function humanizeDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return fa(s) + ' ثانیه';
  const m = Math.round(s / 60);
  if (m < 60) return fa(m) + ' دقیقه';
  const h = Math.floor(m / 60), rm = m % 60;
  return fa(h) + ' ساعت' + (rm ? ' و ' + fa(rm) + ' دقیقه' : '');
}

/* ─────────── ساعت تهران (Asia/Tehran) ─────────── */
const TZ = 'Asia/Tehran';
const fmtDayFull  = new Intl.DateTimeFormat('fa-IR', { timeZone: TZ, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const fmtDayShort = new Intl.DateTimeFormat('fa-IR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtDate = ts => {
  try { return new Intl.DateTimeFormat('fa-IR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); }
  catch (e) { return ''; }
};

let _tzOff = null, _tzOffAt = 0;
function tzOffsetMs(epoch) {
  if (_tzOff != null && Math.abs(epoch - _tzOffAt) < 10 * 60e3) return _tzOff;
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = {};
  for (const { type, value } of dtf.formatToParts(new Date(epoch))) p[type] = value;
  let h = +p.hour; if (h === 24) h = 0;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, h, +p.minute, +p.second);
  _tzOff = asUTC - Math.floor(epoch / 1000) * 1000;
  _tzOffAt = epoch;
  return _tzOff;
}
const wallOf = (epoch, off) => new Date(epoch + (off == null ? tzOffsetMs(epoch) : off));
function tehranDateKey(epoch) {
  const d = wallOf(epoch);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function tehranClock(epoch) {
  const d = wallOf(epoch);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}
function epochOfTehran(y, m, d, hh = 0, mm = 0) {
  const guess = Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMs(Date.now());
  return Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMs(guess);
}
function tehranMidnight(epoch) {
  const d = wallOf(epoch);
  return epochOfTehran(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, 0);
}
/* هفتهٔ ایران از شنبه شروع می‌شود: شنبه=۰ … جمعه=۶ */
const iranianWd = d => (d.getUTCDay() + 1) % 7;
function saturdayStart(epoch) {
  const mid = tehranMidnight(epoch);
  return mid - iranianWd(wallOf(mid)) * 86400e3;
}
/* شروع بلوک ۵ دقیقه‌ایِ شامل این لحظه — بر اساس مضرب‌های ساعت تهران */
function blockStartAt(epoch) {
  const off = tzOffsetMs(epoch);
  const local = epoch + off;
  return Math.floor(local / FIVE_MIN) * FIVE_MIN - off;
}
const blockEndAt = epoch => blockStartAt(epoch) + FIVE_MIN;
function nextMilestoneAfter(epoch) {
  const s = blockStartAt(epoch);
  return (s === epoch) ? epoch + FIVE_MIN : s + FIVE_MIN;
}

/* ─────────── مثلث خیام (هستهٔ امتیازدهی) ───────────
   لولِ امتیازدهیِ هر فعالیت را کاربر مشخص می‌کند.
   دفعهٔ kاُم از یک فعالیت با لول L → درآی kاُم از قطر Lاُم مثلث خیام:
       لول ۱: ۱، ۱، ۱، ۱، …
       لول ۲: ۱، ۲، ۳، ۴، …   (۴ بار ← مجموعاً ۱۰)
       لول ۳: ۱، ۳، ۶، ۱۰، …  (۳ بار ← مجموعاً ۱۰)
   همهٔ امتیازها داخل بلوک ۵ دقیقه‌ایِ جاری ثبت می‌شوند. */
function binom(n, r) {
  if (r < 0 || r > n || n < 0) return 0;
  r = Math.min(r, n - r);
  let res = 1;
  for (let i = 0; i < r; i++) res = res * (n - i) / (i + 1);
  return Math.round(res);
}
const khayamPoint = (L, k) => binom(L + k - 2, k - 1);          /* امتیاز دفعهٔ kاُم */
const khayamCumul = (L, k) => binom(L + k - 1, k - 1);          /* مجموع k دفعه */
const khayamSeq   = (L, n) => Array.from({ length: n }, (_, i) => khayamPoint(L, i + 1));
const MAX_LEVEL = 8;

/* ─────────── سطح رتبه (بر اساس مجموع امتیاز) ─────────── */
const LEVELS = [
  { name: 'مبتدی',   min: 0,    icon: '🌱' },
  { name: 'نوآموز',  min: 100,  icon: '🔷' },
  { name: 'ماهر',    min: 300,  icon: '⭐' },
  { name: 'حرفه‌ای', min: 600,  icon: '🏅' },
  { name: 'متخصص',   min: 1000, icon: '🎯' },
  { name: 'استاد',   min: 1600, icon: '👑' },
  { name: 'قهرمان',  min: 2400, icon: '💎' },
  { name: 'اسطوره',  min: 3500, icon: '🔥' },
];
const levelFor  = p => { let lv = LEVELS[0]; for (const l of LEVELS) if (p >= l.min) lv = l; return lv; };
const nextLevel = p => LEVELS.find(l => l.min > p) || null;

/* ─────────── فعالیت‌های پیش‌فرض ─────────── */
const DEF_DL = { type: 'none', time: '22:00', weekday: 5, day: 1 };
const DEFAULT_ACTIVITIES = [
  { id: 'block5',  name: 'بلوک ۵ دقیقه‌ای', icon: '⏱', minutes: 5,  level: 2, locked: true, deadline: { ...DEF_DL } },
  { id: 'study',   name: 'مطالعه متمرکز',   icon: '📚', minutes: 25, level: 4, deadline: { ...DEF_DL } },
  { id: 'exercise',name: 'ورزش',            icon: '💪', minutes: 15, level: 3, deadline: { ...DEF_DL } },
  { id: 'break',   name: 'استراحت',         icon: '☕', minutes: 10, level: 1, deadline: { ...DEF_DL } },
  { id: 'reading', name: 'کتاب‌خوانی',      icon: '📖', minutes: 20, level: 3, deadline: { ...DEF_DL } },
  { id: 'deep',    name: 'کار عمیق',        icon: '🧠', minutes: 45, level: 5, deadline: { ...DEF_DL } },
];
const EMOJIS = ['⏱','📚','💪','☕','📖','🧠','🎯','💻','🏃','🧹','🎨','🎵','🍽️','💧','🛌','📝'];
const WEEKDAY_FA = { 6: 'شنبه', 0: 'یکشنبه', 1: 'دوشنبه', 2: 'سه‌شنبه', 3: 'چهارشنبه', 4: 'پنجشنبه', 5: 'جمعه' };
const DL_LABEL = { none: 'بدون ضرب‌الاجل', daily: 'روزانه', weekly: 'هفتگی', monthly: 'ماهانه' };

/* ─────────── وضعیت ─────────── */
let activities = store.get('eila_activities', null) || DEFAULT_ACTIVITIES.slice();
let points     = store.get('eila_points', 0);
let counts     = store.get('eila_counts', {});            /* دفعهٔ k هر فعالیت (تاریخچه) */
let log        = store.get('eila_log', []);               /* لاگ فعالیت‌ها */
let blocks     = store.get('eila_blocks', {});            /* امتیاز بلوک‌های ۵ دقیقه‌ای */
let session    = store.get('eila_session', { active: false, firstStart: 0, lastSeal: 0 });
let dlLog      = store.get('eila_dl_log', {});            /* وضعیت دوره‌های ضرب‌الاجل */
let settings   = Object.assign({ sound: true, vibrate: true, volume: 0.9 }, store.get('eila_settings', {}));
let timer      = null;                                    /* تایمر فعالیت جاری */
let overlayMode = null;
let lastDoneActId = null;

const blockAct   = () => activities.find(a => a.id === 'block5');
const saveActs   = () => store.set('eila_activities', activities);
const saveTimer  = () => store.set('eila_timer', timer);
const saveCounts = () => store.set('eila_counts', counts);
const saveBlocks = () => store.set('eila_blocks', blocks);
const saveSession= () => store.set('eila_session', session);
const saveDlLog  = () => store.set('eila_dl_log', dlLog);
const saveSettings = () => store.set('eila_settings', settings);

/* مهاجرت از نسخهٔ قبلی (امتیاز دلخواه → لول مثلث خیام) */
(function migrate() {
  let changed = false;
  for (const a of activities) {
    if (a.level == null) {
      const p = a.points || 0;
      a.level = p > 0 ? Math.min(MAX_LEVEL, Math.max(1, Math.round(Math.log2(p / 5)) + 1)) : 1;
      delete a.points;
      changed = true;
    }
    if (!a.deadline) { a.deadline = { ...DEF_DL }; changed = true; }
  }
  if (!activities.some(a => a.id === 'block5')) {
    activities.unshift({ id: 'block5', name: 'بلوک ۵ دقیقه‌ای', icon: '⏱', minutes: 5, level: 2, locked: true, deadline: { ...DEF_DL } });
    changed = true;
  }
  if (changed) saveActs();
})();

/* ═══════════════════════ صدا (Web Audio) ═══════════════════════ */
let audioCtx = null;
function ensureAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
  return audioCtx;
}
function beep(freq = 880, dur = 0.18, delay = 0, vol) {
  if (!settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const v = (vol == null ? settings.volume : vol);
  if (!v) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, v), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  } catch (e) {}
}
function milestoneSound() { beep(660, .14, 0); beep(880, .14, .2); }
function successSound()   { beep(660, .12, 0); beep(880, .12, .15); beep(1175, .2, .3); }

/* حلقهٔ آلارم ضرب‌الاجل — تا وقتی کاربر ببنده */
let alarmIv = null, alarmStopTo = null;
function alarmLoopStart(autoStopMs = 60000) {
  alarmLoopStop();
  const cycle = () => { beep(988, .22, 0); beep(988, .22, .32); beep(1319, .42, .64); };
  cycle();
  vibrate([400, 120, 400, 120, 600]);
  alarmIv = setInterval(() => { cycle(); vibrate([400, 120, 400, 120, 600]); }, 1400);
  alarmStopTo = setTimeout(alarmLoopStop, autoStopMs);
}
function alarmLoopStop() {
  if (alarmIv)      { clearInterval(alarmIv); alarmIv = null; }
  if (alarmStopTo)  { clearTimeout(alarmStopTo); alarmStopTo = null; }
  if (navigator.vibrate) { try { navigator.vibrate(0); } catch (e) {} }
}

/* ═══════════════════════ ویبره ═══════════════════════ */
function vibrate(pattern) {
  if (settings.vibrate && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch (e) {}
  }
}

/* ═══════════════════════ نوتیفیکیشن ═══════════════════════ */
const NOTIF_ICON = './icons/icon-192.png';
function notifSupported() { return 'Notification' in window; }

async function ensurePermission() {
  if (!notifSupported() || Notification.permission !== 'default') return;
  try { await Notification.requestPermission(); } catch (e) {}
  updatePermUI();
}

async function showNotif(title, body, extra = {}) {
  if (!notifSupported() || Notification.permission !== 'granted') return;
  const opts = {
    body, dir: 'rtl', lang: 'fa',
    icon: NOTIF_ICON,
    badge: NOTIF_ICON,
    tag: extra.tag || 'eila',
    renotify: !!extra.renotify,
    requireInteraction: !!extra.requireInteraction,
    data: { url: location.href }
  };
  if (settings.vibrate) opts.vibrate = [300, 150, 300, 150, 300];
  try {
    const reg = await (navigator.serviceWorker && navigator.serviceWorker.getRegistration());
    if (reg && reg.showNotification) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch (e) {
    try { new Notification(title, opts); } catch (_) {}
  }
}

function updatePermUI() {
  const banner = $('#permBanner'), txt = $('#permText'), btn = $('#permBtn');
  const status = $('#notifStatus'), btn2 = $('#btnPerm2');
  let state, canAsk = false;
  if (!notifSupported()) state = 'پشتیبانی نمی‌شود';
  else if (Notification.permission === 'granted')  state = 'مجاز ✅';
  else if (Notification.permission === 'denied')   state = 'مسدود شده ❌';
  else { state = 'در انتظار اجازه'; canAsk = true; }

  if (status) status.textContent = state;
  if (!notifSupported() || Notification.permission === 'granted') {
    banner.classList.add('hidden');
    if (btn2) btn2.classList.add('hidden');
    return;
  }
  banner.classList.remove('hidden');
  if (btn2) btn2.classList.toggle('hidden', !canAsk);
  if (Notification.permission === 'denied') {
    txt.textContent = '🔔 نوتیفیکیشن مسدود شده — از تنظیمات مرورگر (Site settings → Notifications) اجازه بده و صفحه رو رفرش کن.';
    btn.classList.add('hidden');
  } else {
    txt.textContent = '🔔 برای اینکه آلارم‌ها به دستت برسه، باید نوتیفیکیشن رو مجاز کنی.';
    btn.classList.remove('hidden');
  }
}

/* ═══════════════════════ نصب PWA ═══════════════════════ */
let deferredInstall = null;
function isStandalone() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function updateInstallUI() {
  const st = $('#installStatus'), btn = $('#btnInstall'), hint = $('#installHint');
  if (!st || !btn || !hint) return;
  btn.classList.add('hidden');
  if (isStandalone()) {
    st.textContent = 'نصب شده ✅';
    hint.textContent = 'داری ایلا رو به‌صورت اپ نصب‌شده اجرا می‌کنی؛ نوتیفیکیشن و آلارم‌ها تو این حالت بهترین عملکرد رو دارن.';
  } else if (deferredInstall) {
    st.textContent = 'آمادهٔ نصب';
    btn.classList.remove('hidden');
    hint.textContent = 'یک کلیک کن تا ایلا مثل یه اپ واقعی روی صفحهٔ اصلی گوشی یا دسکتاپ نصب بشه.';
  } else if (isIOS()) {
    st.textContent = 'نصب دستی (iOS)';
    hint.textContent = 'توی سافاری: دکمهٔ اشتراک‌گذاری → «Add to Home Screen». نوتیفیکیشن فقط بعد از نصب کار می‌کند (iOS 16.4 به بالا).';
  } else {
    st.textContent = 'در دسترس نیست';
    hint.textContent = 'توی کروم/اج: منوی ⋮ → «Add to Home screen / نصب برنامه». اگه نبود، یه بار صفحه رو رفرش کن.';
  }
}
function watchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstall = e;
    updateInstallUI();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    updateInstallUI();
    toast('✅ ایلا نصب شد');
  });
}
async function promptInstall() {
  if (!deferredInstall) return;
  const ev = deferredInstall;
  deferredInstall = null;
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice && choice.outcome === 'accepted') toast('📲 در حال نصب ایلا…');
  } catch (e) {}
  updateInstallUI();
}

/* ═══════════════════════ حلقهٔ تیک مشترک ═══════════════════════ */
let tickIv = null, tickWorker = null, _lastMinute = -1;

function startTicking() {
  stopTicking();
  tickIv = setInterval(tick, 300);
  /* ورکر جدا از throttling تبِ بک‌گراند، زمان را دقیق نگه می‌دارد */
  try {
    const code = 'setInterval(function(){postMessage(0)},400);';
    tickWorker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    tickWorker.onmessage = tick;
  } catch (e) {}
}
function stopTicking() {
  if (tickIv) { clearInterval(tickIv); tickIv = null; }
  if (tickWorker) { try { tickWorker.terminate(); } catch (e) {} tickWorker = null; }
}
function tick() {
  const now = Date.now();
  const minuteKey = Math.floor((now + tzOffsetMs(now)) / 60000);
  if (minuteKey !== _lastMinute) { _lastMinute = minuteKey; onMinuteRoll(now); }
  tickBlocks(now);
  tickTimer(now);
  renderTimer();
}
function onMinuteRoll(now) {
  checkDeadlines(now);
  renderScore();
  renderActs();
}

/* ═══════════════════════ موتور بلوک ۵ دقیقه‌ای (خودکار) ═══════════════════════
   بلوک‌ها دقیقاً روی مضرب‌های ۵ دقیقهٔ ساعت تهران شروع و تمام می‌شوند.
   وقتی «شرکت در بلوک‌ها» فعالم باشد، هر بلوک که تمام شود خودش
   امتیازِ دفعهٔ بعدش را از مثلث خیام می‌گیرد و بلوک بعدی خودکار شروع می‌شود. */
const CATCHUP_LIMIT_MS = 60 * 60 * 1000; /* غیبت بیشتر از ۱ ساعت → جلسه قطع می‌شود */

async function joinBlocks() {
  if (session.active) return;
  ensureAudio();
  await ensurePermission();
  const now = Date.now();
  const cur = blockStartAt(now);
  session = { active: true, firstStart: (cur === now ? cur : cur + FIVE_MIN), lastSeal: 0 };
  saveSession();
  renderAll();
  beep(740, .12, 0, .5);
  const b = blockAct();
  showNotif('🧱 شرکت در بلوک‌ها فعال شد',
    `اولین بلوک ${tehranClock(session.firstStart)} خودکار شروع می‌شود · 📐 لول بلوک: ${fa(b ? b.level : 2)}`,
    { tag: 'eila-info' });
  toast('⏳ فعال شد — بلوک بعدی خودکار شروع می‌شود');
}

function leaveBlocks(silent) {
  if (!session.active) return;
  session = { active: false, firstStart: 0, lastSeal: 0 };
  saveSession();
  renderAll();
  if (!silent) {
    toast('⏹ جلسهٔ بلوک‌ها پایان یافت');
    showNotif('⏹ جلسه پایان یافت', 'دیگر بلوک جدیدی خودکار شروع نمی‌شود.', { tag: 'eila-info' });
  }
}

function tickBlocks(now) {
  if (!session.active) return;
  let guarded = 0;
  while (guarded++ < 300) {
    const s = session.lastSeal ? session.lastSeal + FIVE_MIN : session.firstStart;
    const e = s + FIVE_MIN;
    if (e > now) break;
    if (now - e > CATCHUP_LIMIT_MS) {
      leaveBlocks(true);
      toast('⛔ جلسه به‌خاطر غیبت طولانی پایان یافت — بلوک‌های عقب افتاده ثبت نشدند');
      return;
    }
    sealBlock(s);
    session.lastSeal = s;
  }
  saveSession();
}

function sealBlock(start) {
  const b = blockAct() || { id: 'block5', name: 'بلوک ۵ دقیقه‌ای', icon: '⏱', level: 2 };
  const k = (counts['block5'] || 0) + 1;
  counts['block5'] = k;
  saveCounts();
  const pts = khayamPoint(b.level || 2, k);
  const ts = start + FIVE_MIN - 1;
  creditToBlock(ts, { kind: 'block', actId: 'block5', name: b.name, icon: b.icon || '⏱', level: b.level || 2, k, pts, ts });
  const rec = blocks[blockStartAt(ts)];
  milestoneSound();
  vibrate([180, 90, 180]);
  showNotif('🧱 بلوک ثبت شد',
    `${tehranClock(start)} تا ${tehranClock(start + FIVE_MIN)} · +${fa(pts)} امتیاز (لول ${fa(b.level || 2)} · دفعهٔ ${fa(k)}) · مجموع بلوک: ${fa(rec.total)}`,
    { tag: 'eila-block', renotify: true });
  toast(`🧱 بلوک ${tehranClock(start)} ثبت شد · +${fa(pts)} امتیاز`);
}

/* هر امتیازی (فعالیت یا خود بلوک) داخل بلوک ۵ دقیقه‌ایِ همان لحظه ثبت می‌شود */
function creditToBlock(ts, credit) {
  const s = blockStartAt(ts);
  const rec = blocks[s] || { start: s, end: s + FIVE_MIN, total: 0, credits: [] };
  rec.credits.push(credit);
  rec.total += credit.pts;
  blocks[s] = rec;
  points += credit.pts;
  store.set('eila_points', points);
  pruneBlocks();
  saveBlocks();
}
function pruneBlocks() {
  const cutoff = Date.now() - 31 * 86400e3;
  for (const k of Object.keys(blocks)) if (blocks[k].end < cutoff) delete blocks[k];
}

/* ═══════════════════════ تایمر فعالیت ═══════════════════════ */
async function startActivity(actId) {
  if (timer) { toast('یکی از فعالیت‌ها در جریان است'); return; }
  const act = activities.find(a => a.id === actId);
  if (!act || act.id === 'block5') return;
  ensureAudio();
  await ensurePermission();
  keepAwake(true);
  const now = Date.now();
  timer = {
    actId: act.id, name: act.name, icon: act.icon, level: act.level,
    durationMs: act.minutes * 60000,
    startAt: now, endAt: now + act.minutes * 60000,
    elapsed: 0, status: 'running',
    nextMilestone: nextMilestoneAfter(now)
  };
  saveTimer(); startTicking(); renderAll();
  beep(740, .12, 0, .5);
  showNotif('⏱ فعالیت شروع شد',
    `«${act.name}» — ${fa(act.minutes)} دقیقه · 📐 لول ${fa(act.level)} · دفعهٔ بعد: ${fa(khayamPoint(act.level, (counts[act.id] || 0) + 1))} امتیاز`,
    { tag: 'eila-info' });
  toast(`▶ «${act.name}» شروع شد`);
}

function pauseTimer() {
  if (!timer || timer.status !== 'running') return;
  timer.elapsed = Date.now() - timer.startAt;
  timer.status = 'paused';
  saveTimer(); keepAwake(false); renderAll();
}
function resumeTimer() {
  if (!timer || timer.status !== 'paused') return;
  const now = Date.now();
  timer.startAt = now - timer.elapsed;
  timer.endAt = timer.startAt + timer.durationMs;
  timer.nextMilestone = nextMilestoneAfter(now);
  timer.status = 'running';
  saveTimer(); startTicking(); keepAwake(true); renderAll();
}
function addMinute() {
  if (!timer || timer.status === 'done') return;
  timer.durationMs += 60000;
  if (timer.status === 'running') timer.endAt += 60000;
  saveTimer(); renderAll();
  toast('＋۱ دقیقه اضافه شد');
}
function stopTimer() {
  if (!timer) return;
  const t = timer;
  const act = activities.find(a => a.id === t.actId);
  const elapsedMin = Math.round((t.status === 'paused' ? t.elapsed : Date.now() - t.startAt) / 60000);
  log.unshift({ ts: Date.now(), actId: t.actId, name: t.name, icon: t.icon, minutes: elapsedMin, level: act ? act.level : null, points: 0, ok: false });
  if (log.length > 300) log.length = 300;
  store.set('eila_log', log);
  timer = null; store.del('eila_timer');
  stopTicking(); keepAwake(false); renderAll();
  document.title = 'ایلا — ضرب‌الاجل و امتیاز';
  toast('⛔ فعالیت قطع شد — امتیازی نگرفتی');
}

function tickTimer(now) {
  if (!timer || timer.status !== 'running') return;
  checkMilestones(now);
  if (Date.now() >= timer.endAt) { completeTimer(false); return; }
}

/* آلارم اجباریِ مضرب‌های ۵ دقیقه حین فعالیت‌های طولانی */
function checkMilestones(now) {
  if (!timer || timer.status !== 'running') return;
  while (timer.nextMilestone < timer.endAt && timer.nextMilestone <= now) {
    fireMilestone(timer.nextMilestone);
    timer.nextMilestone += FIVE_MIN;
  }
}
function fireMilestone(m) {
  if (session.active) return; /* وقتی جلسهٔ بلوک فعال است، ثبتِ خودِ بلوک آلارم را می‌زند */
  const remaining = timer.endAt - Date.now();
  milestoneSound();
  vibrate([180, 90, 180]);
  showNotif('⏱ مضرب ۵ دقیقه!',
    `«${timer.name}» — ${fa(Math.round((m - timer.startAt) / 60000))} دقیقه شد · ${fmtClock(remaining)} تا پایان`,
    { tag: 'eila-milestone', renotify: true });
  toast(`⏱ عبور از مضرب ${tehranClock(m)} (آلارم اجباری)`);
}

/* ─── پایان فعالیت → امتیاز از مثلث خیام، ثبت در بلوک جاری ─── */
function completeTimer(delayed) {
  if (!timer || timer.status === 'done') return;
  timer.status = 'done';
  timer.delayed = !!delayed;
  const t = timer;
  const act = activities.find(a => a.id === t.actId) || { id: t.actId, name: t.name, icon: t.icon, level: 1 };
  const k = (counts[act.id] || 0) + 1;
  counts[act.id] = k;
  saveCounts();
  const pts = khayamPoint(act.level || 1, k);
  const ts = Date.now();

  const lvBefore = levelFor(points);
  creditToBlock(ts, { kind: 'activity', actId: act.id, name: act.name, icon: act.icon, level: act.level, k, pts, ts });
  const lvAfter = levelFor(points);

  log.unshift({
    ts, actId: act.id, name: act.name, icon: act.icon,
    minutes: Math.round(t.durationMs / 60000),
    level: act.level, k, points: pts, ok: true, delayed: !!delayed
  });
  if (log.length > 300) log.length = 300;
  store.set('eila_log', log);
  t.awarded = true;
  saveTimer();

  stopTicking(); keepAwake(false);
  successSound();
  vibrate([300, 100, 300]);
  showNotif('✅ فعالیت انجام شد',
    `«${act.name}» · دفعهٔ ${fa(k)} · +${fa(pts)} امتیاز (📐 لول ${fa(act.level)}) · ثبت در بلوک ${tehranClock(ts)}`,
    { tag: 'eila-done', renotify: true });
  if (lvAfter !== lvBefore) {
    setTimeout(() => showNotif('🎉 ارتقای سطح!', `به سطح «${lvAfter.name}» ${lvAfter.icon} رسیدی!`, { tag: 'eila-level' }), 1500);
    toast(`🎉 ارتقای سطح: ${lvAfter.icon} ${lvAfter.name}`);
  }

  overlayMode = 'done';
  lastDoneActId = act.id;
  $('#alarmTitle').textContent = '✅ فعالیت تمام شد!';
  $('#alarmText').innerHTML =
    `<b>${esc(act.name)}</b> انجام شد.<br>` +
    `دفعهٔ ${fa(k)} · 📐 لول ${fa(act.level)}<br>` +
    `<span class="ok-text">+${fa(pts)} امتیاز</span> داخل بلوک ۵ دقیقه‌ایِ <b>${tehranClock(ts)}</b> ثبت شد` +
    (t.delayed ? '<br><small>⚠️ این هشدار با تأخیر رسید (برنامه بسته بوده)</small>' : '');
  $('#btnAgain').classList.remove('hidden');
  $('#alarmOverlay').classList.remove('hidden');
  renderAll();
  document.title = '✅ امتیاز گرفتی! | ایلا';
}

/* ─── بازیابی بعد از بستن/رفرش صفحه ─── */
function restoreTimer() {
  const t = store.get('eila_timer', null);
  if (!t) return;
  const now = Date.now();
  if (t.status === 'running') {
    if (now >= t.endAt) { timer = t; completeTimer(true); return; }
    timer = t;
    timer.nextMilestone = nextMilestoneAfter(now);
    saveTimer(); startTicking(); keepAwake(true);
    toast('⏱ فعالیتِ در جریان بازیابی شد');
  } else if (t.status === 'paused') {
    timer = t;
  } else if (t.status === 'done' && t.awarded) {
    timer = t;
    overlayMode = 'done';
    $('#btnAgain').classList.remove('hidden');
    $('#alarmOverlay').classList.remove('hidden');
  }
  renderAll();
}

/* ─── Wake Lock: صفحه موقع فعالیت خاموش نشود ─── */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) {
      if (!wakeLock) wakeLock = await navigator.wakeLock.request('screen');
    } else if (wakeLock) {
      await wakeLock.release(); wakeLock = null;
    }
  } catch (e) {}
}

/* ═══════════════════════ ضرب‌الاجل‌ها (روزانه / هفتگی / ماهانه) ═══════════════════════ */
function dlActive(act) { return act.deadline && act.deadline.type && act.deadline.type !== 'none'; }

function dlLabel(act) {
  const dl = act.deadline;
  if (!dlActive(act)) return '';
  const t = dl.time || '22:00';
  if (dl.type === 'daily')   return `روزانه ${fa(t)}`;
  if (dl.type === 'weekly')  return `هفتگی ${WEEKDAY_FA[dl.weekday] || ''} ${fa(t)}`;
  return `ماهانه روز ${fa(dl.day || 1)} · ${fa(t)}`;
}

function monthlyDue(y, m, dayWanted, hh, mm) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return epochOfTehran(y, m, Math.min(dayWanted, last), hh, mm);
}

function nextDueFor(act, from) {
  const dl = act.deadline;
  if (!dlActive(act)) return null;
  const parts = (dl.time || '22:00').split(':');
  const hh = +parts[0] || 0, mm = +parts[1] || 0;
  if (dl.type === 'daily') {
    const d = wallOf(from);
    let t = epochOfTehran(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hh, mm);
    if (t <= from) t += 86400e3;
    return t;
  }
  if (dl.type === 'weekly') {
    const target = (dl.weekday == null ? 5 : dl.weekday);
    const mid0 = tehranMidnight(from);
    for (let i = 0; i < 8; i++) {
      const dw = wallOf(mid0 + i * 86400e3);
      if (dw.getUTCDay() !== target) continue;
      const t = epochOfTehran(dw.getUTCFullYear(), dw.getUTCMonth() + 1, dw.getUTCDate(), hh, mm);
      if (t > from) return t;
    }
    return null;
  }
  const dayWanted = Math.min(Math.max(1, dl.day || 1), 31);
  const d0 = wallOf(from);
  for (let i = 0; i < 13; i++) {
    let y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1 + i;
    y += Math.floor((m - 1) / 12);
    m = ((m - 1) % 12) + 1;
    const t = monthlyDue(y, m, dayWanted, hh, mm);
    if (t > from) return t;
  }
  return null;
}

function prevDueFor(act, from) {
  const dl = act.deadline;
  if (!dlActive(act)) return null;
  const nd = nextDueFor(act, from);
  if (!nd) return null;
  const parts = (dl.time || '22:00').split(':');
  const hh = +parts[0] || 0, mm = +parts[1] || 0;
  if (dl.type === 'daily')  return nd - 86400e3;
  if (dl.type === 'weekly') return nd - 7 * 86400e3;
  const d = wallOf(nd);
  const dayWanted = Math.min(Math.max(1, dl.day || 1), 31);
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  m -= 1; if (m === 0) { m = 12; y -= 1; }
  return monthlyDue(y, m, dayWanted, hh, mm);
}

function periodStartFor(act, due) {
  const type = act.deadline.type;
  if (type === 'daily')  return tehranMidnight(due);
  if (type === 'weekly') return saturdayStart(due);
  const d = wallOf(due);
  return epochOfTehran(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0);
}

function periodKeyFor(act, due) {
  const type = act.deadline.type;
  if (type === 'monthly') { const d = wallOf(due); return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`; }
  if (type === 'weekly')  return tehranDateKey(saturdayStart(due));
  return tehranDateKey(due);
}

/* تعداد دفعات انجام‌شدهٔ فعالیت داخل یک دوره (از لاگ + امتیازهای بلوک‌ها) */
function completionsIn(actId, from, to) {
  let n = 0;
  for (const e of log) if (e.ok && e.actId === actId && e.ts > from && e.ts <= to) n++;
  for (const rec of Object.values(blocks))
    for (const c of rec.credits)
      if (c.kind === 'activity' && c.actId === actId && c.ts > from && c.ts <= to) n++;
  return n;
}

function checkDeadlines(now) {
  for (const act of activities) {
    if (!dlActive(act)) continue;
    const prev = prevDueFor(act, now);
    if (!prev) continue;
    const key = periodKeyFor(act, prev);
    dlLog[act.id] = dlLog[act.id] || {};
    if (dlLog[act.id][key]) continue;
    const met = completionsIn(act.id, periodStartFor(act, prev), prev) > 0;
    dlLog[act.id][key] = met ? 'met' : 'missed';
    const cutoff = Date.now() - 180 * 86400e3;
    for (const id of Object.keys(dlLog))
      for (const kk of Object.keys(dlLog[id]))
        if (kk.length > 7 && kk < tehranDateKey(cutoff)) delete dlLog[id][kk];
    saveDlLog();
    if (!met) fireDeadlineAlarm(act, prev);
  }
}

function fireDeadlineAlarm(act, due) {
  alarmLoopStart();
  vibrate([500, 150, 500, 150, 800, 200, 800]);
  showNotif('⏰ ضرب‌الاجل گذشت!',
    `ضرب‌الاجل «${act.name}» (${dlLabel(act)}) در ${tehranClock(due)} گذشت و در این دوره انجام نشد ❌`,
    { tag: 'eila-deadline', renotify: true, requireInteraction: true });
  overlayMode = 'deadline';
  $('#alarmTitle').textContent = '⏰ ضرب‌الاجل رسید!';
  $('#alarmText').innerHTML =
    `ضرب‌الاجل <b>${esc(act.name)}</b><br>(${dlLabel(act)})<br>` +
    `در <b>${tehranClock(due)}</b> گذشت و انجام نشد ❌<br>` +
    '<small>برای دورهٔ بعدش برنامه‌ریزی کن.</small>';
  $('#btnAgain').classList.add('hidden');
  $('#alarmOverlay').classList.remove('hidden');
  document.title = '⏰ ضرب‌الاجل! | ایلا';
}

/* ─── اطلاعات نمایشی ضرب‌الاجل هر فعالیت ─── */
let dlCache = {};
function refreshDlCache() {
  const now = Date.now();
  dlCache = {};
  for (const act of activities) {
    if (!dlActive(act)) continue;
    const nd = nextDueFor(act, now);
    const pd = prevDueFor(act, now);
    let lastStatus = null;
    if (pd) {
      const key = periodKeyFor(act, pd);
      lastStatus = (dlLog[act.id] && dlLog[act.id][key]) || null;
    }
    dlCache[act.id] = { nd, pd, lastStatus };
  }
}

/* ═══════════════════════ رندر ═══════════════════════ */
function renderAll() {
  renderHeader(); renderTimer(); renderChips(); renderActs(); renderScore(); renderSettings(); updatePermUI(); updateInstallUI();
}

function renderHeader() {
  const lv = levelFor(points);
  $('#levelChip').textContent = `${lv.icon} ${lv.name} · ${fa(points)} امتیاز`;
}

/* ─── کارت بلوک ۵ دقیقه‌ای + کارت فعالیت جاری + چیپ‌ها ─── */
function renderTimer() {
  const now = Date.now();
  const curStart = blockStartAt(now), curEnd = curStart + FIVE_MIN;
  $('#blockWindow').textContent = `${tehranClock(curStart)} تا ${tehranClock(curEnd)} · ساعت تهران`;
  const rec = blocks[curStart];
  const b = blockAct();
  const blkLevel = b ? b.level : 2;
  const nextBlkPts = khayamPoint(blkLevel, (counts['block5'] || 0) + 1);

  let remaining, frac, status, stake;
  if (session.active && now < session.firstStart) {
    remaining = session.firstStart - now;
    frac = remaining / FIVE_MIN;
    status = '⏳ در انتظار شروعِ خودکار بلوک روی مضرب بعدی…';
    stake = `دفعهٔ بعد بلوک: +${fa(nextBlkPts)} امتیاز (📐 لول ${fa(blkLevel)})`;
  } else if (session.active) {
    remaining = curEnd - now;
    frac = remaining / FIVE_MIN;
    status = '🔴 در حال اجرا — پایان و شروعِ بلوک بعدی خودکار است';
    stake = `امتیاز این بلوک: ${fa(rec ? rec.total : 0)} · دفعهٔ بعد: +${fa(nextBlkPts)}`;
  } else {
    remaining = curEnd - now;
    frac = remaining / FIVE_MIN;
    status = session.lastSeal || session.firstStart ? 'جلسه پایان یافت' : 'غیرفعال — برای امتیاز خودِ بلوک‌ها، «شرکت در بلوک‌ها» را بزن';
    stake = `امتیاز این بلوک: ${fa(rec ? rec.total : 0)}`;
  }
  $('#timeDisplay').textContent = fmtClock(remaining);
  $('#stakeDisplay').textContent = stake;
  $('#blockStatus').textContent = status;
  const ring = $('#ringFg');
  ring.style.strokeDasharray = RING_C;
  ring.style.strokeDashoffset = RING_C * (1 - Math.min(1, Math.max(0, frac)));

  $('#btnJoin').classList.toggle('hidden', session.active);
  $('#btnLeave').classList.toggle('hidden', !session.active);

  const na = $('#nextAlert');
  if (session.active && now < session.firstStart)
    na.textContent = `▶ شروع خودکار: ${tehranClock(session.firstStart)} (${humanizeDur(session.firstStart - now)} مانده)`;
  else if (session.active)
    na.textContent = `⏹ پایان خودکار: ${tehranClock(curEnd)} — بلوک بعدی بلافاصله شروع می‌شود`;
  else
    na.textContent = '🧱 بلوک‌ها روی مضرب‌های ۵ دقیقهٔ ساعت تهران شروع و تمام می‌شوند';

  /* کارت فعالیت جاری */
  const card = $('#actRunningCard');
  if (timer && timer.status !== 'done') {
    card.classList.remove('hidden');
    $('#arName').textContent = `${timer.icon} ${timer.name}`;
    $('#arMeta').textContent = `📐 لول ${fa(timer.level)} · امتیازش داخل بلوکِ همان لحظه ثبت می‌شود`;
    let rem, f;
    if (timer.status === 'running') { rem = timer.endAt - now; f = rem / timer.durationMs; }
    else { rem = timer.durationMs - timer.elapsed; f = rem / timer.durationMs; }
    $('#arTime').textContent = fmtClock(rem);
    $('#arBar').style.width = Math.round(100 * Math.min(1, Math.max(0, f))) + '%';
    $('#btnPause').textContent = timer.status === 'paused' ? '▶ ادامه' : '⏸ توقف موقت';
  } else {
    card.classList.add('hidden');
  }

  if (timer && timer.status === 'running') document.title = `${fmtClock(timer.endAt - now)} | ایلا`;
  else if (session.active) document.title = `${fmtClock(remaining)} · بلوک | ایلا`;
  else document.title = 'ایلا — ضرب‌الاجل و امتیاز';
}

function renderChips() {
  const wrap = $('#activityChips');
  wrap.innerHTML = '';
  const list = activities.filter(a => a.id !== 'block5');
  for (const a of list) {
    const k = (counts[a.id] || 0) + 1;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'chip' + (timer ? ' disabled' : '');
    el.innerHTML =
      `<span class="chip-icon">${a.icon}</span>` +
      `<span class="chip-name">${esc(a.name)}</span>` +
      `<span class="chip-meta">📐 لول ${fa(a.level)} · دفعهٔ ${fa(k)}: +${fa(khayamPoint(a.level, k))} امتیاز${dlActive(a) ? ' · ⏰ ' + dlLabel(a) : ''}</span>`;
    el.addEventListener('click', () => startActivity(a.id));
    wrap.appendChild(el);
  }
}

function renderActs() {
  const wrap = $('#actsList');
  wrap.innerHTML = '';
  refreshDlCache();
  const now = Date.now();
  for (const a of activities) {
    const k = (counts[a.id] || 0) + 1;
    const card = document.createElement('div');
    card.className = 'act-card';
    const lockedTag = a.id === 'block5' ? ' · 🔒 مدت ثابت' : '';
    let dlLine = '';
    if (dlActive(a)) {
      const c = dlCache[a.id];
      const nd = c.nd ? fmtDayShort.format(c.nd) + ' ساعت ' + tehranClock(c.nd) : '';
      const left = c.nd ? ` (${humanizeDur(c.nd - now)} مانده)` : '';
      const st = c.lastStatus === 'met'   ? ' · دورهٔ قبل: <span class="ok-text">✓ انجام شد</span>'
               : c.lastStatus === 'missed'? ' · دورهٔ قبل: <span class="bad-text">✗ از دست رفت</span>' : '';
      dlLine = `<div class="dl-line">⏰ <span class="dl-badge">${dlLabel(a)}</span> · بعدی: ${nd}${left}${st}</div>`;
    }
    const meta = `⏱ ${fa(a.minutes)} دقیقه · 📐 لول ${fa(a.level)} · تاکنون ${fa(counts[a.id] || 0)} بار · دفعهٔ بعد: +${fa(khayamPoint(a.level, k))} امتیاز${lockedTag}`;
    card.innerHTML =
      `<div class="act-ic">${a.icon}</div>` +
      `<div class="act-main"><div class="act-name">${esc(a.name)}</div><div class="act-meta">${meta}</div>${dlLine}</div>` +
      `<div class="act-btns">` +
      `<button class="icon-btn run" title="شروع">▶</button>` +
      `<button class="icon-btn edit" title="ویرایش">✏️</button>` +
      `<button class="icon-btn del" title="حذف" ${a.locked ? 'disabled' : ''}>🗑</button>` +
      `</div>`;
    card.querySelector('.run').addEventListener('click', () => startActivity(a.id));
    card.querySelector('.edit').addEventListener('click', () => openActForm(a));
    card.querySelector('.del').addEventListener('click', () => {
      if (a.locked) return;
      if (!confirm(`فعالیت «${a.name}» حذف بشه؟`)) return;
      activities = activities.filter(x => x.id !== a.id);
      saveActs();
      renderAll();
    });
    wrap.appendChild(card);
  }
}

function renderScore() {
  const lv = levelFor(points), nx = nextLevel(points);
  $('#totalPoints').textContent = fa(points);
  $('#levelBadge').textContent = `${lv.icon} ${lv.name}`;
  const fill = $('#levelProgress');
  if (nx) {
    fill.style.width = Math.round(100 * (points - lv.min) / (nx.min - lv.min)) + '%';
    $('#levelNextText').textContent = `${fa(nx.min - points)} امتیاز تا سطح «${nx.name}» ${nx.icon}`;
  } else {
    fill.style.width = '100%';
    $('#levelNextText').textContent = 'در بالاترین سطحی! 🔥';
  }

  /* آمار — روز و هفتهٔ ایران (ساعت تهران) */
  const now = Date.now();
  let ptsToday = 0, ptsWeek = 0, blockCount = 0;
  const todayStart = tehranMidnight(now), weekStart = saturdayStart(now);
  for (const rec of Object.values(blocks)) {
    if (rec.credits.length) blockCount++;
    for (const c of rec.credits) {
      if (c.ts >= todayStart) ptsToday += c.pts;
      if (c.ts >= weekStart)  ptsWeek  += c.pts;
    }
  }
  $('#statToday').textContent  = fa(ptsToday);
  $('#statWeek').textContent   = fa(ptsWeek);
  $('#statBlocks').textContent = fa(blockCount);

  renderKhayam();
  renderBlockHistory();

  const wrap = $('#logList');
  if (!log.length) {
    wrap.innerHTML = '<div class="empty">هنوز چیزی ثبت نشده — اولین بلوکت رو شروع کن! 🚀</div>';
    return;
  }
  wrap.innerHTML = log.slice(0, 60).map(e => `
    <div class="log-row ${e.ok ? '' : 'bad'}">
      <div class="log-ic">${e.icon || '⏱'}</div>
      <div class="log-main">
        <div class="log-name">${esc(e.name)}</div>
        <div class="log-sub">${fmtDate(e.ts)} · ${timeAgo(e.ts)}${e.ok && e.level ? ` · 📐 لول ${fa(e.level)} · دفعهٔ ${fa(e.k)}` : ''}${e.ok ? ` · ${fa(e.minutes)} دقیقه` : ''}${e.delayed ? ' · ⚠️ با تأخیر' : ''}</div>
      </div>
      <div class="log-pts">${e.ok ? '+' + fa(e.points) : '⛔'}</div>
    </div>`).join('');
}

/* جدول قطرهای مثلث خیام */
function renderKhayam() {
  const wrap = $('#khayamTable');
  if (!wrap) return;
  let html = '';
  for (let L = 1; L <= MAX_LEVEL; L++) {
    const seq = khayamSeq(L, 8).map(x => fa(x)).join('، ');
    html += `<div class="khy-row">
      <span class="khy-lv">لول ${fa(L)}</span>
      <span class="khy-seq">${seq}، …</span>
      <span class="khy-sum">۸ دفعه: ${fa(khayamCumul(L, 8))}</span>
    </div>`;
  }
  wrap.innerHTML = html;
}

/* تاریخچهٔ امتیاز بلوک‌ها — به تفکیک روز و ساعت (ساعت تهران) */
function renderBlockHistory() {
  const wrap = $('#blockHistory');
  if (!wrap) return;
  const recs = Object.values(blocks).filter(r => r.credits.length).sort((a, b) => b.start - a.start);
  if (!recs.length) {
    wrap.innerHTML = '<div class="card"><div class="empty">هنوز بلوکی ثبت نشده — با «شرکت در بلوک‌ها» شروع کن! 🧱</div></div>';
    return;
  }
  const byDay = new Map();
  for (const r of recs) {
    const key = tehranDateKey(r.start);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(r);
  }
  let html = '';
  let dayIdx = 0;
  for (const [key, list] of byDay) {
    if (dayIdx++ >= 7) break; /* هفت روز اخیر */
    const dayTotal = list.reduce((s, r) => s + r.total, 0);
    html += `<div class="card day-card">
      <div class="day-head"><span>📅 ${fmtDayFull.format(list[0].start)}</span><span class="day-total">${fa(dayTotal)} امتیاز</span></div>`;
    const byHour = new Map();
    for (const r of list) {
      const h = tehranClock(r.start).slice(0, 2);
      if (!byHour.has(h)) byHour.set(h, []);
      byHour.get(h).push(r);
    }
    for (const [h, hrs] of byHour) {
      const hourTotal = hrs.reduce((s, r) => s + r.total, 0);
      html += `<div class="hour-head">ساعت ${fa(h)} — ${fa(hourTotal)} امتیاز</div>`;
      for (const r of hrs) {
        const cr = r.credits.map(c => `${c.icon} ${esc(c.name)} +${fa(c.pts)}`).join(' · ');
        html += `<div class="b-row">
          <div><div class="b-win">${tehranClock(r.start)} تا ${tehranClock(r.end)}</div>
          <div class="b-credits">${cr}</div></div>
          <div class="b-pts">${fa(r.total)} امتیاز</div>
        </div>`;
      }
    }
    html += `</div>`;
  }
  wrap.innerHTML = html;
}

function renderSettings() {
  $('#sndToggle').checked = !!settings.sound;
  $('#vibToggle').checked = !!settings.vibrate;
  $('#volSlider').value = settings.volume;
}

/* ═══════════════════════ فرم فعالیت ═══════════════════════ */
function openActForm(a = null) {
  $('#actForm').classList.remove('hidden');
  $('#af-id').value = a ? a.id : '';
  $('#af-name').value = a ? a.name : '';
  $('#af-icon').value = a ? a.icon : '⏱';
  $('#af-min').value = a ? a.minutes : 25;
  const lvl = a ? a.level : 3;
  $('#af-level').value = String(lvl);
  const dl = a ? a.deadline : { ...DEF_DL };
  $('#af-dl-type').value = dl.type || 'none';
  $('#af-dl-time').value = dl.time || '22:00';
  $('#af-dl-weekday').value = String(dl.weekday == null ? 5 : dl.weekday);
  $('#af-dl-day').value = dl.day || 1;
  const locked = !!(a && a.locked);
  $('#af-min').disabled = locked;
  $('#afNote').classList.toggle('hidden', !locked);
  updateLevelPreview();
  updateDlFields();
  $('#actForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateLevelPreview() {
  const L = +$('#af-level').value || 1;
  const id = $('#af-id').value;
  const done = id ? (counts[id] || 0) : 0;
  const seq = khayamSeq(L, 8).map(x => fa(x)).join('، ');
  const nextPts = khayamPoint(L, done + 1);
  $('#afLevelPreview').innerHTML =
    `قطر لول ${fa(L)}: <b>${seq}، …</b><br>` +
    (id ? `تاکنون ${fa(done)} بار انجام شده → دفعهٔ بعد: <b>+${fa(nextPts)} امتیاز</b>`
        : `دفعهٔ اول: ۱ امتیاز، دفعهٔ دوم بیشتر، … (هر دفعه یک خانهٔ جلوتر در مثلث)`);
}

function updateDlFields() {
  const t = $('#af-dl-type').value;
  $('#afDlFields').classList.toggle('hidden', t === 'none');
  $('#afDlWeekRow').classList.toggle('hidden', t !== 'weekly');
  $('#afDlMonthRow').classList.toggle('hidden', t !== 'monthly');
}

function submitActForm(e) {
  e.preventDefault();
  const id = $('#af-id').value;
  const name = $('#af-name').value.trim();
  const icon = ($('#af-icon').value || '⏱').trim();
  let minutes = parseInt($('#af-min').value, 10);
  const level = +$('#af-level').value || 1;
  const dlType = $('#af-dl-type').value;
  const dlTime = $('#af-dl-time').value || '22:00';
  const dlWeekday = +$('#af-dl-weekday').value;
  const dlDay = Math.min(Math.max(1, +$('#af-dl-day').value || 1), 31);
  if (!name) { toast('اسم فعالیت رو بنویس'); return; }
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) { toast('مدت باید بین ۱ تا ۴۸۰ دقیقه باشه'); return; }
  if (!(level >= 1 && level <= MAX_LEVEL)) { toast('لول باید بین ۱ تا ۸ باشه'); return; }

  const deadline = { type: dlType, time: dlTime, weekday: dlWeekday, day: dlDay };
  if (id) {
    const a = activities.find(x => x.id === id);
    if (a) {
      a.name = name; a.icon = icon; a.level = level; a.deadline = deadline;
      if (!a.locked) a.minutes = minutes;
    }
    toast('✏️ فعالیت ویرایش شد');
  } else {
    activities.push({ id: 'a' + Date.now(), name, icon, minutes, level, deadline });
    toast('➕ فعالیت اضافه شد');
  }
  saveActs();
  refreshDlCache();
  $('#actForm').classList.add('hidden');
  renderAll();
}

/* ═══════════════════════ اورلی ═══════════════════════ */
function closeAlarmOverlay(restart) {
  alarmLoopStop();
  $('#alarmOverlay').classList.add('hidden');
  if (overlayMode === 'done') {
    timer = null; store.del('eila_timer');
    document.title = 'ایلا — ضرب‌الاجل و امتیاز';
    if (restart && lastDoneActId) startActivity(lastDoneActId);
  }
  overlayMode = null;
  renderAll();
}

/* ═══════════════════════ توست ═══════════════════════ */
let toastTo = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  if (toastTo) clearTimeout(toastTo);
  toastTo = setTimeout(() => el.classList.add('hidden'), 2800);
}

/* ═══════════════════════ تب‌ها ═══════════════════════ */
function switchTab(tabId) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === tabId));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  window.scrollTo({ top: 0 });
}

/* ═══════════════════════ راه‌اندازی ═══════════════════════ */
function bindEvents() {
  /* تب‌ها */
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  /* بلوک‌ها */
  $('#btnJoin').addEventListener('click', joinBlocks);
  $('#btnLeave').addEventListener('click', () => {
    if (confirm('جلسهٔ بلوک‌ها پایان یابد؟ بلوک‌های جدید خودکار شروع نمی‌شوند.')) leaveBlocks(false);
  });

  /* فعالیت جاری */
  $('#btnPause').addEventListener('click', () => (timer && timer.status === 'paused') ? resumeTimer() : pauseTimer());
  $('#btnAdd1').addEventListener('click', addMinute);
  $('#btnStop').addEventListener('click', () => { if (confirm('فعالیت رو قطع کنی امتیازی نمی‌گیری. مطمئنی؟')) stopTimer(); });

  /* اورلی */
  $('#btnOk').addEventListener('click', () => closeAlarmOverlay(false));
  $('#btnAgain').addEventListener('click', () => closeAlarmOverlay(true));

  /* مجوز نوتیف */
  $('#permBtn').addEventListener('click', ensurePermission);
  $('#btnInstall').addEventListener('click', promptInstall);
  $('#btnPerm2').addEventListener('click', ensurePermission);

  /* فعالیت‌ها */
  $('#btnAddAct').addEventListener('click', () => openActForm(null));
  $('#afCancel').addEventListener('click', () => $('#actForm').classList.add('hidden'));
  $('#actForm').addEventListener('submit', submitActForm);
  $('#af-level').addEventListener('change', updateLevelPreview);
  $('#af-dl-type').addEventListener('change', updateDlFields);
  const emojiRow = $('#emojiRow');
  EMOJIS.forEach(em => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = em;
    b.addEventListener('click', () => { $('#af-icon').value = em; });
    emojiRow.appendChild(b);
  });

  /* تنظیمات */
  $('#sndToggle').addEventListener('change', e => { settings.sound = e.target.checked; saveSettings(); });
  $('#vibToggle').addEventListener('change', e => { settings.vibrate = e.target.checked; saveSettings(); });
  $('#volSlider').addEventListener('input', e => { settings.volume = +e.target.value; saveSettings(); });

  $('#btnTestSound').addEventListener('click', () => { ensureAudio(); milestoneSound(); toast('🔊 تست صدا'); });
  $('#btnTestVib').addEventListener('click', () => { vibrate([400, 120, 400, 120, 600]); toast('📳 تست ویبره'); });
  $('#btnTestNotif').addEventListener('click', async () => {
    await ensurePermission();
    showNotif('🔔 تست نوتیفیکیشن', 'اگر این رو دیدی، آلارم‌ها به دستت می‌رسه ✅', { tag: 'eila-test', renotify: true });
  });
  $('#btnTestAlarm').addEventListener('click', async () => {
    await ensurePermission();
    ensureAudio();
    alarmLoopStart(6000);
    showNotif('🚨 تست آلارم', 'این دقیقاً همون چیزیه که موقع گذشتن ضرب‌الاجل اتفاق می‌افته ✅', { tag: 'eila-test', renotify: true, requireInteraction: true });
    toast('🚨 تست آلارم کامل (۶ ثانیه)');
  });

  $('#btnReset').addEventListener('click', () => {
    if (!confirm('همهٔ امتیازها، بلوک‌ها و تاریخچه پاک بشن؟')) return;
    points = 0; log = []; counts = {}; blocks = {}; dlLog = {};
    session = { active: false, firstStart: 0, lastSeal: 0 };
    store.set('eila_points', points); store.set('eila_log', log);
    saveCounts(); saveBlocks(); saveDlLog(); saveSession();
    timer = null; store.del('eila_timer'); stopTicking();
    renderAll(); toast('🗑 ریست شد');
  });

  /* بازگشت به صفحه */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      tickBlocks(Date.now());
      checkDeadlines(Date.now());
      if (timer && timer.status === 'running') { keepAwake(true); tick(); }
    }
  });

  /* باز کردن قفل صدا با اولین لمس */
  window.addEventListener('pointerdown', ensureAudio, { once: true });
}

async function registerSW() {
  try {
    const proto = location.protocol;
    if ((proto === 'http:' || proto === 'https:') && 'serviceWorker' in navigator) {
      await navigator.serviceWorker.register('./sw.js');
    }
  } catch (e) { console.warn('SW:', e); }
}

function init() {
  bindEvents();
  watchInstallPrompt();
  refreshDlCache();
  renderAll();
  checkDeadlines(Date.now());
  restoreTimer();
  startTicking(); /* حلقهٔ تیک همیشه روشن است: شمارش بلوک + موتور خودکار بلوک‌ها */
  registerSW();
}

/* هوک تست (jsdom) */
window.__eila = {
  khayamPoint, khayamCumul, khayamSeq, blockStartAt, blockEndAt, creditToBlock, sealBlock,
  completionsIn, nextDueFor, prevDueFor,
  state: () => ({ points, counts, blocks, session, timer, activities, log, dlLog })
};

init();
