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
const $loader          = document.getElementById('loader');
const $arena           = document.getElementById('arena');
const $resultStrip     = document.getElementById('resultStrip');
const $resultWin       = document.getElementById('resultWinner');
const $resultHint      = document.getElementById('resultHint');
const $btnNext         = document.getElementById('btnNext');
const $btnReset        = document.getElementById('btnReset');
const $histPanel       = document.getElementById('historyPanel');
const $histList        = document.getElementById('historyList');
const $histCount       = document.getElementById('historyCount');
const $histEmpty       = document.getElementById('historyEmpty');
const $themeBtn        = document.getElementById('themeToggle');
const $histToggleBtn   = document.getElementById('btnHistoryToggle');
const $histCloseBtn    = document.getElementById('btnHistoryClose');
const $drawerOverlay   = document.getElementById('drawerOverlay');

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

/* ── Drawer historique ── */
function openDrawer() {
  $histPanel.classList.add('open');
  $histPanel.setAttribute('aria-hidden', 'false');
  $drawerOverlay.classList.add('visible');
}

function closeDrawer() {
  $histPanel.classList.remove('open');
  $histPanel.setAttribute('aria-hidden', 'true');
  $drawerOverlay.classList.remove('visible');
}

$histToggleBtn.addEventListener('click', openDrawer);
$histCloseBtn.addEventListener('click', closeDrawer);
$drawerOverlay.addEventListener('click', closeDrawer);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
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
  vsDivider.innerHTML = `<div class="vs-pill">OU</div>`;
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

  const snippet = page.description || page.extract.slice(0, 160);

  card.innerHTML = `
    ${page.image
      ? `<img class="card-img" src="${page.image}" alt="${escapeHtml(page.title)}" loading="lazy">`
      : `<div class="card-img-placeholder">📄</div>`
    }
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

  card.addEventListener('click', () => choose(idx));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(idx); }
  });

  return card;
}

/* ── Choice logic ── */
function choose(idx) {
  const alreadyChosen = state.chosen;
  if (alreadyChosen && state.chosenIdx === idx) return;

  state.chosen    = true;
  state.chosenIdx = idx;

  const cardA = document.getElementById('card-0');
  const cardB = document.getElementById('card-1');
  const winner = idx === 0 ? cardA : cardB;
  const loser  = idx === 0 ? cardB : cardA;

  winner.classList.add('winner');
  winner.classList.remove('loser');
  loser.classList.add('loser');
  loser.classList.remove('winner');

  $resultStrip.classList.add('visible');
  $resultWin.textContent  = state.pages[idx].title;
  $resultHint.textContent = alreadyChosen ? 'Choix modifié !' : 'Tape l\'autre carte pour changer d\'avis';

  $btnNext.disabled = false;

  if (!alreadyChosen) {
    state.history.unshift({
      winner: state.pages[idx].title,
      loser:  state.pages[1 - idx].title,
    });
  } else {
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

  // Mettre à jour le compteur
  $histCount.textContent = `${h.length} choix`;

  // Cacher/montrer l'état vide
  if ($histEmpty) $histEmpty.style.display = h.length ? 'none' : 'block';

  $histList.innerHTML = h.slice(0, 50).map((entry, i) => `
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
  $histCount.textContent = '0 choix';
  $histList.innerHTML = '';
  if ($histEmpty) $histEmpty.style.display = 'block';
  loadRound();
});

/* ── Raccourcis clavier ── */
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
