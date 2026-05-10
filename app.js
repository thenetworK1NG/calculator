/* ============================================================
   app.js — Calculator / Menu PWA
   ============================================================ */

/* ─── State ──────────────────────────────────────────────── */
let allStock        = [];
let menuIcons       = [];
let menuFilter      = 'all';
let menuSearch      = '';
let menuStrain      = 'all';
let menuTag         = 'all';
let deferredInstall = null;
let unsubStock      = null;
let menuBooted      = false;

/* ─── PWA Install ────────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err =>
      console.warn('SW registration failed:', err)
    );
  });
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  document.getElementById('installBtn').hidden = false;
});

window.addEventListener('appinstalled', () => {
  document.getElementById('installBtn').hidden = true;
  deferredInstall = null;
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  if (outcome === 'accepted') document.getElementById('installBtn').hidden = true;
  deferredInstall = null;
});

/* ─── Calculator ─────────────────────────────────────────── */
let calcCurrent = '0';
let calcPrev    = null;
let calcOp      = null;
let calcFresh   = false;   /* next digit replaces display */
let calcSeq     = [];      /* raw press log for secret detection */

const _calcResult     = document.getElementById('calcResult');
const _calcExpression = document.getElementById('calcExpression');

function calcUpdateDisplay() {
  const len = calcCurrent.length;
  _calcResult.style.fontSize =
    len > 12 ? '2.2rem' : len > 9 ? '3rem' : len > 6 ? '3.8rem' : '4.5rem';
  _calcResult.textContent = calcCurrent;
}

function calcFormat(n) {
  if (!isFinite(n)) return 'Error';
  const s = parseFloat(n.toPrecision(10));
  const str = String(s);
  return str.length > 12 ? s.toExponential(4) : str;
}

function calcEval(a, b, op) {
  switch (op) {
    case '+': return a + b;
    case '−': return a - b;
    case '×': return a * b;
    case '÷': return b !== 0 ? a / b : NaN;
    default:  return b;
  }
}

function calcInput(val) {
  calcSeq.push(val);
  if (calcFresh) {
    calcCurrent = val === '.' ? '0.' : val;
    calcFresh = false;
  } else {
    if (val === '.' && calcCurrent.includes('.')) return;
    calcCurrent = (calcCurrent === '0' && val !== '.') ? val : calcCurrent + val;
  }
  calcUpdateDisplay();
}

function calcDoOp(op) {
  calcSeq.push(op);
  if (calcPrev !== null && !calcFresh) {
    calcPrev    = calcEval(calcPrev, parseFloat(calcCurrent), calcOp);
    calcCurrent = calcFormat(calcPrev);
  } else {
    calcPrev = parseFloat(calcCurrent);
  }
  calcOp    = op;
  calcFresh = true;
  _calcExpression.textContent = calcFormat(calcPrev) + ' ' + op;
  calcUpdateDisplay();
}

function calcEquals() {
  calcSeq.push('=');
  /* Secret: typing 4 + 2 0 = reveals the menu */
  if (calcSeq.slice(-5).join('') === '4+20=') {
    unlockMenu();
    return;
  }
  if (calcOp === null || calcPrev === null) return;
  const result = calcEval(calcPrev, parseFloat(calcCurrent), calcOp);
  _calcExpression.textContent =
    calcFormat(calcPrev) + ' ' + calcOp + ' ' + calcCurrent + ' =';
  calcCurrent = calcFormat(result);
  calcPrev    = null;
  calcOp      = null;
  calcFresh   = true;
  calcUpdateDisplay();
}

function calcClear() {
  calcCurrent = '0';
  calcPrev    = null;
  calcOp      = null;
  calcFresh   = false;
  calcSeq     = [];
  _calcExpression.textContent = '';
  calcUpdateDisplay();
}

function calcSign() {
  if (calcCurrent === '0' || calcCurrent === 'Error') return;
  calcCurrent = calcCurrent.startsWith('-')
    ? calcCurrent.slice(1)
    : '-' + calcCurrent;
  calcUpdateDisplay();
}

function calcPercent() {
  calcCurrent = calcFormat(parseFloat(calcCurrent) / 100);
  calcFresh   = true;
  calcUpdateDisplay();
}

document.querySelectorAll('.calc-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    switch (action) {
      case 'num':     calcInput(btn.dataset.val); break;
      case 'dot':     calcInput('.');             break;
      case 'op':      calcDoOp(btn.dataset.op);   break;
      case 'equals':  calcEquals();               break;
      case 'clear':   calcClear();                break;
      case 'sign':    calcSign();                 break;
      case 'percent': calcPercent();              break;
    }
  });
});

/* ─── Unlock / Lock ──────────────────────────────────────── */
function unlockMenu() {
  document.getElementById('calcView').hidden = true;
  document.getElementById('menuView').hidden = false;
  calcClear();
  if (!menuBooted) {
    menuBooted = true;
    bootMenu();
  }
}

function lockMenu() {
  document.getElementById('menuView').hidden = true;
  document.getElementById('calcView').hidden = false;
}

document.getElementById('calcBackBtn').addEventListener('click', lockMenu);

/* ─── Helpers ────────────────────────────────────────────── */
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

function iconSrc(icon) {
  return (icon && icon !== 'none') ? `icons/${icon}.png` : null;
}

function catLabel(cat) {
  return { weed: 'Weed', edibles: 'Edibles', vapes: 'Vapes', joints: 'Joints', dabs: 'Dabs' }[cat] || cat;
}

const TAG_LABELS = {
  'tunnel':            'Tunnel',
  'indoor':            'Indoor',
  'exotic-greenhouse': 'Exotic GH',
  'greenhouse':        'Greenhouse',
  'outdoor':           'Outdoor'
};

const STRAIN_LABELS = {
  'sativa':        'Sativa',
  'indica':        'Indica',
  'hybrid':        'Hybrid',
  'sativa-hybrid': 'Sativa/Hybrid',
  'indica-hybrid': 'Indica/Hybrid'
};

function strainLabel(strain) {
  return STRAIN_LABELS[strain] || (strain ? strain.charAt(0).toUpperCase() + strain.slice(1) : '');
}

function renderTagBadges(tags) {
  if (!tags || typeof tags !== 'object') return '';
  return Object.keys(tags)
    .filter(k => tags[k])
    .map(k => `<span class="tag-badge tag-${esc(k)}">${esc(TAG_LABELS[k] || k)}</span>`)
    .join('');
}

/* ─── Toast ──────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ─── Icon Registry ──────────────────────────────────────── */
async function loadIcons() {
  try {
    const res  = await fetch('icons/icons.json');
    menuIcons  = await res.json();
  } catch (err) {
    console.warn('Could not load icons.json:', err);
    menuIcons = [];
  }
}

/* ─── Render Menu Grid ───────────────────────────────────── */
function renderMenu() {
  const grid    = document.getElementById('menuGrid');
  const empty   = document.getElementById('menuEmpty');
  const counter = document.getElementById('menuCount');

  /* Only show items that are in stock, not manually marked sold out, and not hidden */
  let filtered = allStock.filter(i => i.quantity > 0 && !i.soldOut && !i.hiddenFromMenu);

  /* Category filter */
  if (menuFilter !== 'all') {
    filtered = filtered.filter(i => i.category === menuFilter);
  }

  /* Name search */
  if (menuSearch) {
    filtered = filtered.filter(i => i.name.toLowerCase().includes(menuSearch));
  }

  /* Strain filter */
  if (menuStrain !== 'all') {
    filtered = filtered.filter(i => i.strain === menuStrain);
  }

  /* Tag filter */
  if (menuTag !== 'all') {
    filtered = filtered.filter(i => i.tags && i.tags[menuTag]);
  }

  /* Default sort: category → strain → name */
  const CAT_ORDER    = ['weed','joints','edibles','dabs','vapes'];
  const STRAIN_ORDER = ['sativa','sativa-hybrid','hybrid','indica-hybrid','indica'];
  filtered.sort((a, b) => {
    const ca = CAT_ORDER.indexOf(a.category);
    const cb = CAT_ORDER.indexOf(b.category);
    if (ca !== cb) return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb);
    const sa = STRAIN_ORDER.indexOf(a.strain);
    const sb = STRAIN_ORDER.indexOf(b.strain);
    if (sa !== sb) return (sa === -1 ? 99 : sa) - (sb === -1 ? 99 : sb);
    return (a.name || '').localeCompare(b.name || '');
  });

  if (filtered.length === 0) {
    counter.textContent = '0 items available';
    grid.innerHTML = '';
    empty.hidden   = false;
    return;
  }

  empty.hidden = true;

  /* Group items with the same name + category + strain into one card */
  const groupMap = new Map();
  for (const item of filtered) {
    const key = `${item.name.toLowerCase()}|||${item.category}|||${item.strain || ''}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { rep: item, grams: [], anyLowStock: false });
    }
    const group = groupMap.get(key);
    if (item.gramsInfo) {
      const label = String(item.gramsInfo).trim();
      if (label && !group.grams.includes(label)) group.grams.push(label);
    }
    if (item.quantity > 0 && item.quantity <= 5) group.anyLowStock = true;
  }

  counter.textContent = groupMap.size === 1
    ? '1 item available'
    : `${groupMap.size} items available`;

  grid.innerHTML = Array.from(groupMap.values()).map(({ rep: item, grams, anyLowStock }) => {
    const src     = iconSrc(item.icon);
    const tagHtml = renderTagBadges(item.tags);

    /* Sort gram options numerically so they display in ascending order */
    grams.sort((a, b) => parseFloat(a) - parseFloat(b));

    return `
      <div class="stock-card cat-${esc(item.category)}">
        <div class="card-icon-area">
          ${src
            ? `<img src="${esc(src)}" alt="${esc(item.name)}" class="card-icon-img">`
            : `<div class="card-icon-placeholder"></div>`}
        </div>
        <div class="card-body">
          <div class="card-top">
            <span class="card-name">${esc(item.name)}</span>
            <span class="cat-badge cat-${esc(item.category)}">${esc(catLabel(item.category))}</span>
          </div>
          ${item.strain ? `
          <div class="card-meta">
            <span class="strain-badge strain-${esc(item.strain)}">${esc(strainLabel(item.strain))}</span>
          </div>` : ''}
          ${tagHtml ? `<div class="card-tags">${tagHtml}</div>` : ''}
          ${grams.length > 0 ? `
          <div class="card-grams">
            ${grams.map(g => `<span class="grams-pill">${esc(g)}g</span>`).join('')}
          </div>` : ''}
          ${item.infoMessage ? `
          <div class="card-info-msg">💬 ${esc(item.infoMessage)}</div>` : ''}
          ${anyLowStock ? `
          <div class="low-stock-nudge">🔥 Get it while there are some left!</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

/* ─── Filters ────────────────────────────────────────────── */

/* Category */
document.querySelectorAll('[data-cat]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    menuFilter = btn.dataset.cat;
    renderMenu();
  });
});

/* Strain */
document.querySelectorAll('.strain-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.strain-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    menuStrain = btn.dataset.strain;
    renderMenu();
  });
});

/* Cultivation tags */
document.querySelectorAll('.tag-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tag-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    menuTag = btn.dataset.tag;
    renderMenu();
  });
});

/* Search */
const _searchInput = document.getElementById('menuSearch');
const _searchClear = document.getElementById('searchClearBtn');

_searchInput.addEventListener('input', e => {
  menuSearch = e.target.value.trim().toLowerCase();
  _searchClear.hidden = !e.target.value;
  renderMenu();
});

_searchClear.addEventListener('click', () => {
  _searchInput.value  = '';
  _searchClear.hidden = true;
  menuSearch = '';
  renderMenu();
});

/* ─── Menu Boot (called on first unlock) ────────────────── */
async function bootMenu() {
  await loadIcons();
  unsubStock = listenStock(items => {
    allStock = items;
    renderMenu();
  });
}
