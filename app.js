/* ============================================================
   TU PRÉFÈRES — Application Logic
   ============================================================ */

'use strict';

/* ── Config ── */
const LANG = 'fr';
const API  = `https://${LANG}.wikipedia.org/api/rest_v1`;

/* ── Catégories Wikipedia par mode ── */
const PLACE_CATEGORIES = [
  'Villes_de_France', 'Capitales', 'Île', 'Montagne', 'Océan',
  'Lac', 'Fleuve', 'Pays', 'Continent', 'Désert',
  'Forêt', 'Parc_national', 'Région_française',
];

const PEOPLE_CATEGORIES = [
  'Acteur_français', 'Chanteur_français', 'Footballeur', 'Écrivain_français',
  'Philosophe', 'Scientifique', 'Personnage_de_fiction', 'Politicien_français',
  'Peintre_français', 'Réalisateur_français',
];

/* ── State ── */
let state = {
  pages:     [null, null],
  chosen:    false,
  chosenIdx: -1,
  history:   [],
  mode:      'classic', // 'classic' | 'connected' | 'places' | 'people'
};

/* ── DOM refs ── */
const $loader        = document.getElementById('loader');
const $arena         = document.getElementById('arena');
const $btnNext       = document.getElementById('btnNext');
const $btnReset      = document.getElementById('btnReset');
const $histPanel     = document.getElementById('historyPanel');
const $histList      = document.getElementById('historyList');
const $histCount     = document.getElementById('historyCount');
const $histEmpty     = document.getElementById('historyEmpty');
const $themeBtn      = document.getElementById('themeToggle');
const $histToggleBtn = document.getElementById('btnHistoryToggle');
const $histCloseBtn  = document.getElementById('btnHistoryClose');
const $drawerOverlay = document.getElementById('drawerOverlay');
const $modeBtns      = document.querySelectorAll('.mode-btn');

/* ── Theme ── */
(function initTheme() {
  const saved = localStorage.getItem('tp-theme');
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', saved || preferred);
})();

$themeBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('tp-theme', next);
});

/* ── Mode selector ── */
$modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.mode = btn.dataset.mode;
    $modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadRound();
  });
});

/* ── Drawer ── */
function openDrawer()  { $histPanel.classList.add('open'); $histPanel.setAttribute('aria-hidden','false'); $drawerOverlay.classList.add('visible'); }
function closeDrawer() { $histPanel.classList.remove('open'); $histPanel.setAttribute('aria-hidden','true'); $drawerOverlay.classList.remove('visible'); }

$histToggleBtn.addEventListener('click', openDrawer);
$histCloseBtn.addEventListener('click', closeDrawer);
$drawerOverlay.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

/* ── Wikipedia fetch ── */
async function fetchRandom() {
  const r = await fetch(`${API}/page/random/summary`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseSummary(await r.json());
}

async function fetchFromCategory(categoryList) {
  const cat = categoryList[Math.floor(Math.random() * categoryList.length)];
  const url = `https://${LANG}.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Catégorie:${encodeURIComponent(cat)}&cmlimit=50&cmtype=page&format=json&origin=*`;
  const r = await fetch(url);
  const d = await r.json();
  const members = d.query?.categorymembers || [];

  // Filtre les pages de liste et de portail
  const filtered = members.filter(m =>
    !m.title.startsWith('Liste') &&
    !m.title.startsWith('Portail') &&
    !m.title.startsWith('Catégorie') &&
    !m.title.includes('(homonymie)')
  );

  if (!filtered.length) return fetchFromCategory(categoryList); // retry avec une autre catégorie
  const pick = filtered[Math.floor(Math.random() * filtered.length)];
  return fetchSummaryByTitle(pick.title);
}

async function fetchSummaryByTitle(title) {
  const r = await fetch(`${API}/page/summary/${encodeURIComponent(title)}`);
  if (!r.ok) return fetchRandom(); // fallback si introuvable
  return parseSummary(await r.json());
}


function parseSummary(d) {
  return {
    title:       d.title,
    description: d.description || '',
    extract:     d.extract     || '',
    image:       d.thumbnail?.source || null,
    url:         d.content_urls?.desktop?.page
                 || `https://${LANG}.wikipedia.org/wiki/${encodeURIComponent(d.title)}`,
  };
}

/* ── Fetch pair selon le mode ── */
async function fetchPair() {
  const mode = state.mode;

  if (mode === 'classic') {
    const results = await Promise.allSettled([fetchRandom(), fetchRandom()]);
    return results.map(r => r.status === 'fulfilled' ? r.value : fallbackPage());
  }


  if (mode === 'connected') {
    // On tire une page source au hasard (jamais affichée)
    const source = await fetchRandom().catch(() => null);
    if (!source) return [fallbackPage(), fallbackPage()];

    // On récupère ses liens internes
    const url = `https://${LANG}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(source.title)}&prop=links&pllimit=100&plnamespace=0&format=json&origin=*`;
    const r = await fetch(url);
    const d = await r.json();
    const pages = d.query?.pages || {};
    const links = Object.values(pages)[0]?.links || [];

    if (links.length < 2) return [fallbackPage(), fallbackPage()];

    // On pioche deux liens différents au hasard
    const shuffle = [...links].sort(() => Math.random() - .5);
    const [a, b] = await Promise.allSettled([
      fetchSummaryByTitle(shuffle[0].title),
      fetchSummaryByTitle(shuffle[1].title),
    ]);

    const pageA = a.status === 'fulfilled' ? a.value : fallbackPage();
    const pageB = b.status === 'fulfilled' ? b.value : fallbackPage();

    // On ajoute le tag pour savoir d'où ça vient
    pageA._tag = `via "${source.title}"`;
    pageB._tag = `via "${source.title}"`;

    return [pageA, pageB];
  }



  if (mode === 'places') {
    const [a, b] = await Promise.allSettled([
      fetchFromCategory(PLACE_CATEGORIES),
      fetchFromCategory(PLACE_CATEGORIES),
    ]);
    return [
      a.status === 'fulfilled' ? a.value : fallbackPage(),
      b.status === 'fulfilled' ? b.value : fallbackPage(),
    ];
  }

  if (mode === 'people') {
    const [a, b] = await Promise.allSettled([
      fetchFromCategory(PEOPLE_CATEGORIES),
      fetchFromCategory(PEOPLE_CATEGORIES),
    ]);
    return [
      a.status === 'fulfilled' ? a.value : fallbackPage(),
      b.status === 'fulfilled' ? b.value : fallbackPage(),
    ];
  }

  return [fallbackPage(), fallbackPage()];
}

function fallbackPage() {
  return { title: 'Article indisponible', description: '', extract: '', image: null, url: `https://${LANG}.wikipedia.org` };
}

/* ── Round ── */
async function loadRound() {
  state.chosen    = false;
  state.chosenIdx = -1;
  showLoader(true);
  $btnNext.disabled = true;
  state.pages = await fetchPair();
  showLoader(false);
  renderArena();
}

function showLoader(show) {
  $loader.style.display = show ? 'flex' : 'none';
  $arena.style.display  = show ? 'none' : 'flex';
}

/* ── Arena ── */
function renderArena() {
  $arena.innerHTML = '';
  $arena.appendChild(buildCard(state.pages[0], 0));
  const vs = document.createElement('div');
  vs.className = 'vs-divider';
  vs.innerHTML = `<div class="vs-pill">OU</div>`;
  $arena.appendChild(vs);
  $arena.appendChild(buildCard(state.pages[1], 1));
}

function buildCard(page, idx) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `card-${idx}`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Choisir : ${page.title}`);

  const snippet = page.description || page.extract.slice(0, 160);
  const tag = page._tag ? `<span class="mode-tag">${escapeHtml(page._tag)}</span>` : '';

  card.innerHTML = `
    ${page.image
      ? `<img class="card-img" src="${page.image}" alt="${escapeHtml(page.title)}" loading="lazy">`
      : `<div class="card-img-placeholder">📄</div>`}
    <div class="card-body">
      ${tag}
      <div class="card-title">${escapeHtml(page.title)}</div>
      ${snippet ? `<div class="card-snippet">${escapeHtml(snippet)}</div>` : ''}
      <div class="card-footer">
        <a class="wiki-btn" href="${page.url}" target="_blank" rel="noopener noreferrer">↗ Wikipedia</a>
      </div>
    </div>
  `;

  card.addEventListener('click', () => choose(idx));
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(idx); } });
  return card;
}

/* ── Choice ── */
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

  $btnNext.disabled = false;

  const entry = { winner: state.pages[idx].title, loser: state.pages[1 - idx].title, mode: state.mode };
  if (!alreadyChosen) state.history.unshift(entry);
  else state.history[0] = entry;

  renderHistory();
}

/* ── History ── */
const MODE_ICONS = { classic: '🎲', connected: '🔗', places: '🌍', people: '👤' };

function renderHistory() {
  const h = state.history;
  $histCount.textContent = `${h.length} choix`;
  if ($histEmpty) $histEmpty.style.display = h.length ? 'none' : 'block';

  $histList.innerHTML = h.slice(0, 50).map((entry, i) => `
    <li class="history-item">
      <span class="h-num" title="${entry.mode}">${MODE_ICONS[entry.mode] || '·'}</span>
      <span class="h-winner">${escapeHtml(entry.winner)}</span>
      <span class="h-vs">ou</span>
      <span class="h-loser">${escapeHtml(entry.loser)}</span>
    </li>
  `).join('');
}

/* ── Controls ── */
$btnNext.addEventListener('click', () => { if (state.chosen) loadRound(); });
$btnReset.addEventListener('click', () => {
  state.history = [];
  $histCount.textContent = '0 choix';
  $histList.innerHTML = '';
  if ($histEmpty) $histEmpty.style.display = 'block';
  loadRound();
});

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' && !$btnNext.disabled) loadRound();
  if (e.key === '1') choose(0);
  if (e.key === '2') choose(1);
});

/* ── Helpers ── */
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Boot ── */
loadRound();
