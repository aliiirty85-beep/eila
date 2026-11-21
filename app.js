'use strict';
/* ════════════════════════════════════════════════════════════
   ایلا — ضرب‌الاجل، امتیاز و سطح
   آلارم اجباری: هر ۵ دقیقه → نوتیف + صدا + ویبره
   ════════════════════════════════════════════════════════════ */

/* ─────────── ابزارها ─────────── */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const fa = n => String(n).replace(/\d/g, d => FA_DIGITS[+d]);
const pad2 = n => String(n).padStart(2, '0');
const fmtClock = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return fa(pad2(Math.floor(s / 60))) + ':' + fa(pad2(s % 60));
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
const fmtDate = ts => {
  try { return new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts)); }
  catch (e) { return ''; }
};

/* ─────────── سطح‌ها ─────────── */
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
const levelFor    = p => { let lv = LEVELS[0]; for (const l of LEVELS) if (p >= l.min) lv = l; return lv; };
const nextLevel   = p => LEVELS.find(l => l.min > p) || null;

/* ─────────── فعالیت‌های پیش‌فرض ─────────── */
const DEFAULT_ACTIVITIES = [
  { id: 'block5',  name: 'بلوک ۵ دقیقه‌ای', icon: '⏱', minutes: 5,  points: 10, locked: true },
  { id: 'study',   name: 'مطالعه متمرکز',   icon: '📚', minutes: 25, points: 50 },
  { id: 'exercise',name: 'ورزش',            icon: '💪', minutes: 15, points: 30 },
  { id: 'break',   name: 'استراحت',         icon: '☕', minutes: 10, points: 5 },
  { id: 'reading', name: 'کتاب‌خوانی',      icon: '📖', minutes: 20, points: 40 },
  { id: 'deep',    name: 'کار عمیق',        icon: '🧠', minutes: 45, points: 90 },
];
const EMOJIS = ['⏱','📚','💪','☕','📖','🧠','🎯','💻','🏃','🧹','🎨','🎵','🍽️','💧','🛌','📝'];

/* ─────────── وضعیت ─────────── */
let activities   = store.get('eila_activities', null) || DEFAULT_ACTIVITIES.slice();
let points       = store.get('eila_points', 0);
let log          = store.get('eila_log', []);
let settings     = Object.assign({ sound: true, vibrate: true, volume: 0.9 }, store.get('eila_settings', {}));
let selectedActId = store.get('eila_selected', 'block5');
let timer        = null; // وضعیت تایمر جاری

const currentAct = () => activities.find(a => a.id === selectedActId) || activities[0];
const saveActs   = () => store.set('eila_activities', activities);
const saveTimer  = () => store.set('eila_timer', timer);
const saveSettings = () => store.set('eila_settings', settings);

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

/* حلقهٔ آلارم پایان ضرب‌الاجل — تا وقتی کاربر ببنده */
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
/* آیکون نوتیف: در نسخهٔ چندفایلی مسیر نسبی، در نسخهٔ تک‌فایل (eila.html)
   با اسکریپت build_single.py به data-URI تبدیل می‌شود تا هیچ مشکلی از مسیر نباشد. */
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

/* ═══════════════════════ موتور تایمر ═══════════════════════ */
let tickIv = null, tickWorker = null;

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
  if (!timer || timer.status !== 'running') return;
  checkMilestones();
  if (Date.now() >= timer.endAt) { finishTimer(false); return; }
  renderTimer();
}

/* ─── آلارم اجباریِ هر ۵ دقیقه ─── */
function checkMilestones() {
  if (!timer || timer.status !== 'running') return;
  const now = Date.now();
  while (true) {
    const m = timer.milestones + 1;
    const mTime = timer.startAt + m * FIVE_MIN;
    if (mTime < timer.endAt && mTime <= now) {
      timer.milestones = m;
      fireMilestone(m);
      saveTimer();
    } else break;
  }
}
function fireMilestone(m) {
  const remaining = timer.endAt - Date.now();
  milestoneSound();
  vibrate([180, 90, 180]);
  showNotif(
    '⏱ ۵ دقیقه گذشت!',
    `«${timer.name}» — ${fa(m * 5)} دقیقه انجام شد · ${fmtClock(remaining)} باقی مانده`,
    { tag: 'eila-milestone', renotify: true }
  );
  toast(`⏱ عبور از ${fa(m * 5)} دقیقه (آلارم اجباری)`);
}

/* ─── شروع / توقف ─── */
async function startTimer() {
  if (timer) return;
  const act = currentAct();
  ensureAudio();
  await ensurePermission();
  keepAwake(true);
  const now = Date.now();
  const durationMs = act.minutes * 60000;
  timer = {
    actId: act.id, name: act.name, icon: act.icon,
    pointsAtStake: act.points, durationMs,
    startAt: now, endAt: now + durationMs,
    elapsed: 0, milestones: 0, status: 'running'
  };
  saveTimer(); startTicking(); renderAll();
  beep(740, .12, 0, .5);
  showNotif(
    '⏱ تایمر شروع شد',
    `«${act.name}» — ${fa(act.minutes)} دقیقه · ${fa(act.points)} امتیاز در میان${act.minutes > 5 ? ' · آلارم ۵ دقیقه‌ای: فعال' : ''}`,
    { tag: 'eila-info' }
  );
  toast(`▶ «${act.name}» شروع شد`);
}

function pauseTimer() {
  if (!timer || timer.status !== 'running') return;
  timer.elapsed = Date.now() - timer.startAt;
  timer.status = 'paused';
  saveTimer(); stopTicking(); keepAwake(false); renderAll();
}
function resumeTimer() {
  if (!timer || timer.status !== 'paused') return;
  const now = Date.now();
  timer.startAt = now - timer.elapsed;
  timer.endAt = timer.startAt + timer.durationMs;
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
  const elapsedMin = Math.round(((t.status === 'paused' ? t.elapsed : Date.now() - t.startAt)) / 60000);
  log.unshift({ ts: Date.now(), name: t.name, icon: t.icon, minutes: elapsedMin, points: 0, ok: false });
  if (log.length > 300) log.length = 300;
  store.set('eila_log', log);
  timer = null; store.del('eila_timer');
  stopTicking(); keepAwake(false); renderAll();
  document.title = 'ایلا — ضرب‌الاجل و امتیاز';
  toast('⛔ بلوک قطع شد — امتیازی نگرفتی');
}

/* ─── پایان ضرب‌الاجل ─── */
function finishTimer(delayed) {
  if (!timer || timer.status === 'done') return;
  timer.status = 'done';
  timer.delayed = !!delayed;
  const t = timer;

  const lvBefore = levelFor(points);
  points += t.pointsAtStake;
  const lvAfter = levelFor(points);

  log.unshift({
    ts: Date.now(), name: t.name, icon: t.icon,
    minutes: Math.round(t.durationMs / 60000),
    points: t.pointsAtStake, ok: true, delayed: !!delayed
  });
  if (log.length > 300) log.length = 300;
  t.awarded = true;
  store.set('eila_points', points);
  store.set('eila_log', log);
  saveTimer();

  stopTicking(); keepAwake(false);

  /* آلارم! صدا + ویبره + نوتیف روی صفحه قفل */
  alarmLoopStart();
  vibrate([500, 150, 500, 150, 800, 200, 800]);
  showNotif(
    '⏰ ضرب‌الاجل رسید!',
    `بلوک «${t.name}» تمام شد — ${fa(t.pointsAtStake)} امتیاز گرفتی ✅${delayed ? ' (هشدار با تأخیر)' : ''}`,
    { tag: 'eila-alarm', renotify: true, requireInteraction: true }
  );
  if (lvAfter !== lvBefore) {
    setTimeout(() => showNotif('🎉 ارتقای سطح!', `به سطح «${lvAfter.name}» ${lvAfter.icon} رسیدی!`, { tag: 'eila-level' }), 1500);
    toast(`🎉 ارتقای سطح: ${lvAfter.icon} ${lvAfter.name}`);
  }

  showAlarmOverlay(t);
  renderAll();
  document.title = '⏰ ضرب‌الاجل رسید! | ایلا';
}

/* ─── بازیابی بعد از بستن/رفرش صفحه ─── */
function restoreTimer() {
  const t = store.get('eila_timer', null);
  if (!t) return;
  const now = Date.now();
  if (t.status === 'running') {
    if (now >= t.endAt) { timer = t; finishTimer(true); return; }
    timer = t;
    const elapsed = now - t.startAt;
    const maxM = Math.floor((t.durationMs - 1) / FIVE_MIN);
    t.milestones = Math.max(0, Math.min(Math.floor(elapsed / FIVE_MIN), maxM));
    saveTimer(); startTicking(); keepAwake(true);
    toast('⏱ تایمرِ در جریان بازیابی شد');
  } else if (t.status === 'paused') {
    timer = t;
  } else if (t.status === 'done' && t.awarded) {
    timer = t;
    alarmLoopStart();
    showAlarmOverlay(t);
  }
  renderAll();
}

/* ─── Wake Lock: صفحه موقع تایمر خاموش نشود ─── */
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

/* ═══════════════════════ رندر ═══════════════════════ */
function renderAll() {
  renderHeader(); renderChips(); renderTimer(); renderActs(); renderScore(); updatePermUI(); renderSettings(); updateInstallUI();
}

function renderHeader() {
  const lv = levelFor(points);
  $('#levelChip').textContent = `${lv.icon} ${lv.name} · ${fa(points)} امتیاز`;
}

function renderChips() {
  const wrap = $('#activityChips');
  wrap.innerHTML = '';
  const list = activities.slice().sort((a, b) =>
    (a.id === 'block5' ? -1 : b.id === 'block5' ? 1 : 0));
  for (const a of list) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'chip' + (a.id === selectedActId ? ' selected' : '') + (timer ? ' disabled' : '');
    el.innerHTML =
      `<span class="chip-icon">${a.icon}</span>` +
      `<span class="chip-name">${esc(a.name)}</span>` +
      `<span class="chip-meta">⏱ ${fa(a.minutes)} دقیقه · ${fa(a.points)} امتیاز</span>`;
    el.addEventListener('click', () => {
      if (timer) return;
      selectedActId = a.id;
      store.set('eila_selected', selectedActId);
      renderAll();
    });
    wrap.appendChild(el);
  }
}

function timerView() {
  if (!timer) {
    const act = currentAct();
    return { name: `${act.icon} ${act.name}`, remaining: act.minutes * 60000, frac: 1, has: false, running: false, paused: false, stake: act.points, next: null };
  }
  const now = Date.now();
  let remaining, frac;
  if (timer.status === 'running')      { remaining = timer.endAt - now;               frac = remaining / timer.durationMs; }
  else if (timer.status === 'paused')  { remaining = timer.durationMs - timer.elapsed; frac = remaining / timer.durationMs; }
  else                                 { remaining = 0; frac = 0; }
  let next = null;
  if (timer.status === 'running') {
    const m = timer.startAt + (timer.milestones + 1) * FIVE_MIN;
    next = (m < timer.endAt - 500) ? m : timer.endAt;
  }
  return {
    name: `${timer.icon} ${timer.name}`, remaining, frac: Math.min(1, Math.max(0, frac)),
    has: true, running: timer.status === 'running', paused: timer.status === 'paused',
    stake: timer.pointsAtStake, next
  };
}

function renderTimer() {
  const v = timerView();
  $('#currentActivityName').textContent = v.name;
  $('#timeDisplay').textContent = fmtClock(v.remaining);
  $('#stakeDisplay').textContent = `${fa(v.stake)} امتیاز`;
  const ring = $('#ringFg');
  ring.style.strokeDasharray = RING_C;
  ring.style.strokeDashoffset = RING_C * (1 - v.frac);

  $('#btnStart').classList.toggle('hidden', v.has);
  $('#btnPause').classList.toggle('hidden', !v.running && !v.paused);
  $('#btnAdd1').classList.toggle('hidden', !v.has || timer.status === 'done');
  $('#btnStop').classList.toggle('hidden', !v.has || timer.status === 'done');
  $('#btnPause').textContent = v.paused ? '▶ ادامه' : '⏸ توقف موقت';

  const na = $('#nextAlert');
  if (v.running && v.next)      na.textContent = `🔔 هشدار بعدی: ${fmtClock(v.next - Date.now())}`;
  else if (v.paused)            na.textContent = '⏸ متوقف شده';
  else if (!v.has)              na.textContent = '';
  else                          na.textContent = '';

  if (v.running) document.title = `${fmtClock(v.remaining)} | ایلا`;
  else if (!v.has || v.paused) document.title = 'ایلا — ضرب‌الاجل و امتیاز';
}

function renderActs() {
  const wrap = $('#actsList');
  wrap.innerHTML = '';
  for (const a of activities) {
    const card = document.createElement('div');
    card.className = 'act-card';
    const meta = `⏱ ${fa(a.minutes)} دقیقه · ⭐ ${fa(a.points)} امتیاز` + (a.id === 'block5' ? ' · 🔒 ثابت' : '');
    card.innerHTML =
      `<div class="act-ic">${a.icon}</div>` +
      `<div class="act-main"><div class="act-name">${esc(a.name)}</div><div class="act-meta">${meta}</div></div>` +
      `<div class="act-btns">` +
      `<button class="icon-btn edit" title="ویرایش">✏️</button>` +
      `<button class="icon-btn del" title="حذف" ${a.locked ? 'disabled' : ''}>🗑</button>` +
      `</div>`;
    card.querySelector('.edit').addEventListener('click', () => openActForm(a));
    card.querySelector('.del').addEventListener('click', () => {
      if (a.locked) return;
      if (!confirm(`فعالیت «${a.name}» حذف بشه؟`)) return;
      activities = activities.filter(x => x.id !== a.id);
      if (selectedActId === a.id) { selectedActId = 'block5'; store.set('eila_selected', selectedActId); }
      saveActs(); renderAll();
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
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = Date.now() - 7 * 86400e3;
  const ok = log.filter(e => e.ok);
  $('#statToday').textContent  = fa(ok.filter(e => e.ts >= todayStart.getTime()).reduce((s, e) => s + e.points, 0));
  $('#statWeek').textContent   = fa(ok.filter(e => e.ts >= weekAgo).reduce((s, e) => s + e.points, 0));
  $('#statBlocks').textContent = fa(ok.length);

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
        <div class="log-sub">${fmtDate(e.ts)} · ${timeAgo(e.ts)}${e.ok ? ` · ${fa(e.minutes)} دقیقه` : ''}${e.delayed ? ' · ⚠️ با تأخیر' : ''}</div>
      </div>
      <div class="log-pts">${e.ok ? '+' + fa(e.points) : '⛔'}</div>
    </div>`).join('');
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
  $('#af-pts').value = a ? a.points : 20;
  const locked = !!(a && a.locked);
  $('#af-min').disabled = locked;
  $('#afNote').classList.toggle('hidden', !locked);
  $('#actForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function submitActForm(e) {
  e.preventDefault();
  const id = $('#af-id').value;
  const name = $('#af-name').value.trim();
  const icon = ($('#af-icon').value || '⏱').trim();
  let minutes = parseInt($('#af-min').value, 10);
  const pts = parseInt($('#af-pts').value, 10);
  if (!name) { toast('اسم فعالیت رو بنویس'); return; }
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) { toast('مدت باید بین ۱ تا ۴۸۰ دقیقه باشه'); return; }
  if (!Number.isFinite(pts) || pts < 0 || pts > 9999) { toast('امتیاز باید بین ۰ تا ۹۹۹۹ باشه'); return; }

  if (id) {
    const a = activities.find(x => x.id === id);
    if (a) {
      a.name = name; a.icon = icon; a.points = pts;
      if (!a.locked) a.minutes = minutes;
    }
    toast('✏️ فعالیت ویرایش شد');
  } else {
    activities.push({ id: 'a' + Date.now(), name, icon, minutes, points: pts });
    toast('➕ فعالیت اضافه شد');
  }
  saveActs();
  $('#actForm').classList.add('hidden');
  renderAll();
}

/* ═══════════════════════ اورلی آلارم ═══════════════════════ */
function showAlarmOverlay(t) {
  $('#alarmTitle').textContent = '⏰ ضرب‌الاجل رسید!';
  $('#alarmText').innerHTML =
    `بلوک <b>${esc(t.name)}</b> تمام شد.<br>` +
    `${fa(t.pointsAtStake)} امتیاز گرفتی ✅` +
    (t.delayed ? '<br><small>⚠️ این هشدار با تأخیر رسید (برنامه بسته بوده)</small>' : '');
  $('#alarmOverlay').classList.remove('hidden');
}
function closeAlarmOverlay(restart) {
  alarmLoopStop();
  $('#alarmOverlay').classList.add('hidden');
  timer = null; store.del('eila_timer');
  document.title = 'ایلا — ضرب‌الاجل و امتیاز';
  renderAll();
  if (restart) startTimer();
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

  /* تایمر */
  $('#btnStart').addEventListener('click', startTimer);
  $('#btnPause').addEventListener('click', () => (timer && timer.status === 'paused') ? resumeTimer() : pauseTimer());
  $('#btnAdd1').addEventListener('click', addMinute);
  $('#btnStop').addEventListener('click', () => { if (confirm('بلوک رو قطع کنی امتیازی نمی‌گیری. مطمئنی؟')) stopTimer(); });

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
    showNotif('🚨 تست آلارم', 'این دقیقاً همون چیزیه که موقع رسیدن ضرب‌الاجل اتفاق می‌افته ✅', { tag: 'eila-test', renotify: true, requireInteraction: true });
    toast('🚨 تست آلارم کامل (۶ ثانیه)');
  });

  $('#btnReset').addEventListener('click', () => {
    if (!confirm('همهٔ امتیازها و تاریخچه پاک بشن؟')) return;
    points = 0; log = [];
    store.set('eila_points', points); store.set('eila_log', log);
    renderAll(); toast('🗑 ریست شد');
  });

  /* بازگشت به صفحه */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (timer && timer.status === 'running') { keepAwake(true); tick(); }
    }
  });

  /* باز کردن قفل صدا با اولین لمس */
  window.addEventListener('pointerdown', ensureAudio, { once: true });
}

async function registerSW() {
  /* سرویس‌ورکر فقط روی http/https کار می‌کند؛ روی file:// (باز کردن مستقیم فایل)
     اصلاً تلاش نکن تا خطای مسیر نگیری — برنامه بدون SW هم کامل کار می‌کند. */
  try {
    const proto = location.protocol;
    if ((proto === 'http:' || proto === 'https:') && 'serviceWorker' in navigator) {
      await navigator.serviceWorker.register('./sw.js');
    }
  } catch (e) { console.warn('SW:', e); }
}

function init() {
  if (!activities.some(a => a.id === 'block5')) {
    activities.unshift({ id: 'block5', name: 'بلوک ۵ دقیقه‌ای', icon: '⏱', minutes: 5, points: 10, locked: true });
    saveActs();
  }
  bindEvents();
  watchInstallPrompt();
  renderAll();
  restoreTimer();
  registerSW();
}

init();
