/* ============================================================
   TU PRÉFÈRES — Application Logic
   ============================================================ */

'use strict';

/* ── Config ── */
const LANG = 'fr';
const API  = `https://${LANG}.wikipedia.org/api/rest_v1`;

/* ── State ── */
let state = {
  pages:     [null, null],
  chosen:    false,
  chosenIdx: -1,
  history:   [],
};

/* ── DOM refs ── */
const $loader      = document.getElementById('loader');
const $arena       = document.getElementById('arena');
const $resultStrip = document.getElementById('resultStrip');
const $resultWin   = document.getElementById('resultWinner');
const $resultHint  = document.getElementById('resultHint');
const $btnNext     = document.getElementById('btnNext');
const $btnReset    = document.getElementById('btnReset');
const $histPanel   = document.getElementById('historyPanel');
const $histList    = document.getElementById('historyList');
const $histCount   = document.getElementById('historyCount');
const $themeBtn    = document.getElementById('themeToggle');

/* ── Theme ── */
(function initTheme() {
  const saved = localStorage.getItem('tp-theme');
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', saved || preferred);
})();

$themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('tp-theme', next);
});

/* ── Wikipedia fetch ── */
async function fetchRandom() {
  const r = await fetch(`${API}/page/random/summary`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  return {
    title:       d.title,
    description: d.description || '',
    extract:     d.extract     || '',
    image:       d.thumbnail?.source || null,
    url:         d.content_urls?.desktop?.page
                 || `https://${LANG}.wikipedia.org/wiki/${encodeURIComponent(d.title)}`,
  };
}

async function fetchPair() {
  const results = await Promise.allSettled([fetchRandom(), fetchRandom()]);
  return results.map(r => r.status === 'fulfilled' ? r.value : {
    title: 'Article indisponible',
    description: '',
    extract: '',
    image: null,
    url: `https://${LANG}.wikipedia.org`,
  });
}

/* ── Round management ── */
async function loadRound() {
  // Reset UI
  state.chosen    = false;
  state.chosenIdx = -1;

  showLoader(true);
  clearResult();
  $btnNext.disabled = true;

  state.pages = await fetchPair();

  showLoader(false);
  renderArena();
}

function showLoader(show) {
  $loader.style.display = show ? 'flex' : 'none';
  $arena.style.display  = show ? 'none' : 'flex';
}

function clearResult() {
  $resultStrip.classList.remove('visible');
  $resultWin.textContent  = '—';
  $resultHint.textContent = '';
}

/* ── Card rendering ── */
function renderArena() {
  $arena.innerHTML = '';

  $arena.appendChild(buildCard(state.pages[0], 0));

  const vsDivider = document.createElement('div');
  vsDivider.className = 'vs-divider';
  vsDivider.innerHTML = `<div class="vs-pill">VS</div>`;
  $arena.appendChild(vsDivider);

  $arena.appendChild(buildCard(state.pages[1], 1));
}

function buildCard(page, idx) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id        = `card-${idx}`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Choisir : ${page.title}`);

  const imgHTML = page.image
    ? `<img class="card-img" src="${page.image}" alt="${escapeHtml(page.title)}" loading="lazy"
           onerror="this.replaceWith(makePlaceholder())">`
    : `<div class="card-img-placeholder">📄</div>`;

  const snippet = page.description || page.extract.slice(0, 160);

  card.innerHTML = `
    ${imgHTML}
    <div class="card-body">
      <div class="card-option">
        <span class="option-badge">
          Option ${idx === 0 ? 'A' : 'B'}
          <span class="check-icon">✓</span>
        </span>
      </div>
      <div class="card-title">${escapeHtml(page.title)}</div>
      ${snippet ? `<div class="card-snippet">${escapeHtml(snippet)}</div>` : ''}
      <div class="card-footer">
        <a class="wiki-btn" href="${page.url}" target="_blank" rel="noopener noreferrer"
           aria-label="Ouvrir Wikipedia">
          ↗ Wikipedia
        </a>
      </div>
    </div>
  `;

  // Click & keyboard
  card.addEventListener('click', () => choose(idx));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(idx); }
  });

  return card;
}

/* ── Choice logic ── */
function choose(idx) {
  const alreadyChosen = state.chosen;
  if (alreadyChosen && state.chosenIdx === idx) return; // same card — no-op

  const prevIdx  = state.chosenIdx;
  state.chosen    = true;
  state.chosenIdx = idx;

  const cardA = document.getElementById('card-0');
  const cardB = document.getElementById('card-1');
  const winner = idx === 0 ? cardA : cardB;
  const loser  = idx === 0 ? cardB : cardA;

  // Flip classes
  winner.classList.add('winner');
  winner.classList.remove('loser');
  loser.classList.add('loser');
  loser.classList.remove('winner');

  // Result strip
  $resultStrip.classList.add('visible');
  $resultWin.textContent  = state.pages[idx].title;
  $resultHint.textContent = alreadyChosen ? 'Choix modifié !' : 'Tape l\'autre carte pour changer d\'avis';

  // Enable next
  $btnNext.disabled = false;

  // History
  if (!alreadyChosen) {
    // New choice
    state.history.unshift({
      winner: state.pages[idx].title,
      loser:  state.pages[1 - idx].title,
    });
  } else {
    // Changed mind — update top entry
    state.history[0] = {
      winner: state.pages[idx].title,
      loser:  state.pages[1 - idx].title,
    };
  }

  renderHistory();
}

/* ── History rendering ── */
function renderHistory() {
  const h = state.history;
  if (!h.length) return;

  $histPanel.classList.add('visible');
  $histCount.textContent = `${h.length} choix`;

  $histList.innerHTML = h.slice(0, 12).map((entry, i) => `
    <li class="history-item">
      <span class="h-num">${h.length - i}</span>
      <span class="h-winner">${escapeHtml(entry.winner)}</span>
      <span class="h-vs">ou</span>
      <span class="h-loser">${escapeHtml(entry.loser)}</span>
    </li>
  `).join('');
}

/* ── Controls ── */
$btnNext.addEventListener('click', () => {
  if (state.chosen) loadRound();
});

$btnReset.addEventListener('click', () => {
  state.history = [];
  $histPanel.classList.remove('visible');
  $histList.innerHTML = '';
  $histCount.textContent = '0 choix';
  loadRound();
});

/* ── Keyboard shortcut (→ next) ── */
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' && !$btnNext.disabled) loadRound();
  if (e.key === '1') choose(0);
  if (e.key === '2') choose(1);
});

/* ── Helpers ── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Boot ── */
loadRound();
