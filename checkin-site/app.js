// ---- Test constants (edit these) ----
const START_DATE = '2026-11-24';   // Day 1 of the closed test (window restarted Nov 24)
const DAYS = 14;
const REQUIRED = 12;               // Google needs at least 12 opted in
const TRACK_FROM = '2026-11-24';   // check-ins begin here; earlier days are not tracked
const TIMEZONE = 'America/New_York';

// Public anon/publishable key only. Never put the service role key here.
const SUPABASE_URL = 'https://sutwtioaupdpcazhzoss.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dCr65dquGFVgCyf7zhk7Ow_eoX_jYuI';

const $ = (id) => document.getElementById(id);
// Zero-width space lets long emails wrap before the @ instead of mid-word.
const wrapAt = (e) => e.replace('@', '​@');
const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };

// 'YYYY-MM-DD' for now in New York, regardless of the phone's time zone.
const todayNY = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
const toUTC = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
const addDays = (d, n) => new Date(toUTC(d) + n * 86400000).toISOString().slice(0, 10);
const pretty = (d, opts) => new Date(toUTC(d)).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

console.assert(daysBetween('2026-11-24', '2026-12-07') === 13 && addDays('2026-11-30', 1) === '2026-12-01', 'date math');

let roster = [];
let checkins = [];
let pending = null;

async function load() {
  const [r, c] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/roster?select=id,email&order=sort_order`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/checkins?select=roster_id,check_date&check_date=gte.${TRACK_FROM}`, { headers }),
  ]);
  if (!r.ok || !c.ok) throw new Error('load failed');
  roster = await r.json();
  checkins = await c.json();
  render();
}

function render() {
  const today = todayNY();
  const dayNum = daysBetween(START_DATE, today) + 1;
  const open = today >= TRACK_FROM;
  const doneToday = new Set(checkins.filter((c) => c.check_date === today).map((c) => c.roster_id));

  $('day').textContent =
    dayNum < 1 ? `Starts ${pretty(START_DATE, { weekday: 'long', month: 'long', day: 'numeric' })}`
    : dayNum > DAYS ? 'Keep checking in until we tell you we are done.'
    : `Day ${dayNum} of ${DAYS} - ${pretty(today, { weekday: 'long', month: 'long', day: 'numeric' })}`;

  $('people').replaceChildren(...roster.map((p) => {
    const b = document.createElement('button');
    b.className = 'person';
    const email = Object.assign(document.createElement('span'), { className: 'email', textContent: wrapAt(p.email) });
    const circle = Object.assign(document.createElement('span'), { className: 'circle' });
    circle.setAttribute('aria-hidden', 'true');
    b.append(email, circle);
    if (doneToday.has(p.id)) {
      b.classList.add('done');
      b.disabled = true;
      circle.textContent = '✓';
      email.append(Object.assign(document.createElement('small'), { textContent: 'Done for today' }));
    } else if (!open) {
      b.disabled = true;
    } else {
      b.onclick = () => { pending = p; $('confirmEmail').textContent = wrapAt(p.email); $('confirm').showModal(); };
    }
    return b;
  }));

  const n = doneToday.size;
  $('count').textContent = `${n} of ${roster.length} checked in today (need at least ${REQUIRED})`;
  $('barFill').style.width = `${roster.length ? (100 * n) / roster.length : 0}%`;
  $('barFill').style.background = n >= REQUIRED ? '#2E7D32' : '#C96442';
  $('waiting').replaceChildren(...roster.filter((p) => !doneToday.has(p.id))
    .map((p) => Object.assign(document.createElement('li'), { textContent: wrapAt(p.email) })));

  // Grid: one row per person, one column per test day.
  const days = Array.from({ length: DAYS }, (_, i) => addDays(START_DATE, i));
  const has = new Set(checkins.map((c) => `${c.roster_id}|${c.check_date}`));
  const head = `<tr><th>Name</th>${days.map((d) => `<th title="${d}">${pretty(d, { month: 'numeric', day: 'numeric' })}</th>`).join('')}</tr>`;
  const rows = roster.map((p) => {
    const cells = days.map((d) => {
      if (has.has(`${p.id}|${d}`)) return '<td class="yes">✓</td>';
      if (d < TRACK_FROM || d > today) return '<td></td>';
      return d === today ? '<td>·</td>' : '<td class="no">✗</td>';
    }).join('');
    return `<tr><td title="${p.email}">${p.email.split('@')[0]}</td>${cells}</tr>`;
  });
  $('grid').innerHTML = head + rows.join('');
}

function showMessage(text, isError) {
  const m = $('message');
  m.textContent = text;
  m.classList.toggle('error', !!isError);
  m.hidden = false;
  m.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('cancel').onclick = () => $('confirm').close();
$('yes').onclick = async () => {
  $('confirm').close();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/checkins`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ roster_id: pending.id, check_date: todayNY() }),
  }).catch(() => null);
  // 409 = already checked in today (unique constraint); treat as success.
  if (res && (res.ok || res.status === 409)) showMessage('Thank you, you are checked in for today');
  else showMessage('Sorry, that did not work. Please check your internet and try again.', true);
  load().catch(() => {});
};

// Refresh when the tab comes back (e.g. left open overnight).
document.addEventListener('visibilitychange', () => { if (!document.hidden) load().catch(() => {}); });

load().catch(() => showMessage('Could not load the list. Please check your internet and refresh.', true));
