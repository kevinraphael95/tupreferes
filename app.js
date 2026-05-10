'use strict';

const LANG = 'fr';
const API  = `https://${LANG}.wikipedia.org/api/rest_v1`;

const PLACE_CATEGORIES = [
  'Villes_de_France','Capitales','Île','Montagne','Océan',
  'Lac','Fleuve','Pays','Continent','Désert',
  'Forêt','Parc_national','Région_française',
];

const PEOPLE_CATEGORIES = [
  'Acteur_français','Chanteur_français','Footballeur','Écrivain_français',
  'Philosophe','Scientifique','Personnage_de_fiction','Politicien_français',
  'Peintre_français','Réalisateur_français',
];

let state = {
  pages: [null, null], chosen: false, chosenIdx: -1, history: [], mode: 'classic',
};

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

/* ── Mode ── */
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

/* ── Wikipedia ── */
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
  const members = (d.query?.categorymembers || []).filter(m =>
    !m.title.startsWith('Liste') && !m.title.startsWith('Portail') &&
    !m.title.startsWith('Catégorie') && !m.title.includes('(homonymie)')
  );
  if (!members.length) return fetchFromCategory(categoryList);
  return fetchSummaryByTitle(members[Math.floor(Math.random() * members.length)].title);
}

async function fetchSummaryByTitle(title) {
  const r = await fetch(`${API}/page/summary/${encodeURIComponent(title)}`);
  if (!r.ok) return fetchRandom();
  return parseSummary(await r.json());
}

function parseSummary(d) {
  return {
    title:       d.title,
    description: d.description || '',
    extract:     d.extract     || '',
    image:       d.thumbnail?.source || null,
    url:         d.content_urls?.desktop?.page || `https://${LANG}.wikipedia.org/wiki/${encodeURIComponent(d.title)}`,
  };
}

async function fetchPair() {
  const mode = state.mode;

  if (mode === 'classic') {
    const results = await Promise.allSettled([fetchRandom(), fetchRandom()]);
    return results.map(r => r.status === 'fulfilled' ? r.value : fallbackPage());
  }

  if (mode === 'connected') {
    const source = await fetchRandom().catch(() => null);
    if (!source) return [fallbackPage(), fallbackPage()];
    const url = `https://${LANG}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(source.title)}&prop=links&pllimit=100&plnamespace=0&format=json&origin=*`;
    const r = await fetch(url);
    const d = await r.json();
    const links = Object.values(d.query?.pages || {})[0]?.links || [];
    if (links.length < 2) return [fallbackPage(), fallbackPage()];
    const shuffle = [...links].sort(() => Math.random() - .5);
    const [a, b] = await Promise.allSettled([fetchSummaryByTitle(shuffle[0].title), fetchSummaryByTitle(shuffle[1].title)]);
    const pageA = a.status === 'fulfilled' ? a.value : fallbackPage();
    const pageB = b.status === 'fulfilled' ? b.value : fallbackPage();
    pageA._tag = `via "${source.title}"`;
    pageB._tag = `via "${source.title}"`;
    return [pageA, pageB];
  }

  if (mode === 'places') {
    const [a, b] = await Promise.allSettled([fetchFromCategory(PLACE_CATEGORIES), fetchFromCategory(PLACE_CATEGORIES)]);
    return [a.status === 'fulfilled' ? a.value : fallbackPage(), b.status === 'fulfilled' ? b.value : fallbackPage()];
  }

  if (mode === 'people') {
    const [a, b] = await Promise.allSettled([fetchFromCategory(PEOPLE_CATEGORIES), fetchFromCategory(PEOPLE_CATEGORIES)]);
    return [a.status === 'fulfilled' ? a.value : fallbackPage(), b.status === 'fulfilled' ? b.value : fallbackPage()];
  }

  return [fallbackPage(), fallbackPage()];
}

function fallbackPage() {
  return { title: 'Article indisponible', description: '', extract: '', image: null, url: `https://${LANG}.wikipedia.org` };
}

/* ── Round ── */
async function loadRound() {
  state.chosen = false; state.chosenIdx = -1;
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
  state.chosen = true; state.chosenIdx = idx;

  const winner = document.getElementById(`card-${idx}`);
  const loser  = document.getElementById(`card-${1 - idx}`);
  winner.classList.add('winner'); winner.classList.remove('loser');
  loser.classList.add('loser');   loser.classList.remove('winner');
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

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadRound();

/* ── Typewriter background ── */
/* ── Typewriter background — extraits Wikipedia aléatoires ── */
(function initTypewriter() {
  const stage = document.getElementById('tw-stage');
  if (!stage) return;

  const POOL_SIZE = 10;
  const TICK      = 48;    /* ms par lettre */
  const STAY      = 5000;  /* ms affiché complet */
  const FADE_OUT  = 1000;
  const MIN_DELAY = 1800;
  const MAX_DELAY = 4500;

  function rand(a, b) { return Math.random() * (b - a) + a; }

  /* Fetch un extrait Wikipedia aléatoire (quelques mots) */
  async function fetchSnippet() {
    try {
      const r = await fetch('https://fr.wikipedia.org/api/rest_v1/page/random/summary');
      if (!r.ok) throw new Error();
      const d = await r.json();
      const src = d.description || d.extract || d.title || '';
      /* On prend un morceau de 3 à 7 mots */
      const words = src.split(/\s+/).filter(Boolean);
      if (words.length < 2) return d.title;
      const start = Math.floor(Math.random() * Math.max(1, words.length - 6));
      const len   = Math.floor(rand(3, 7));
      return words.slice(start, start + len).join(' ');
    } catch {
      return null;
    }
  }

  async function spawnWord() {
    if (stage.querySelectorAll('.tw-word').length >= POOL_SIZE) return;

    const text = await fetchSnippet();
    if (!text) return;

    const el = document.createElement('span');
    el.className = 'tw-word';
    el.style.left     = rand(2, 80) + 'vw';
    el.style.top      = rand(5, 90) + 'vh';
    el.style.fontSize = rand(.6, .95).toFixed(2) + 'rem';
    stage.appendChild(el);

    /* Frappe lettre par lettre */
    let i = 0;
    const type = setInterval(() => {
      el.textContent = text.slice(0, ++i);
      if (i === 1) el.classList.add('visible');
      if (i >= text.length) {
        clearInterval(type);
        setTimeout(() => {
          el.classList.remove('visible');
          setTimeout(() => el.remove(), FADE_OUT);
        }, STAY);
      }
    }, TICK);
  }

  function loop() {
    spawnWord();
    setTimeout(loop, rand(MIN_DELAY, MAX_DELAY));
  }

  /* Quelques mots au démarrage */
  for (let i = 0; i < 3; i++) setTimeout(spawnWord, i * 1200);
  loop();
})();
