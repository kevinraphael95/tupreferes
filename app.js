/* ============================================================
   TU PRÉFÈRES — Application Logic
   ============================================================ */

'use strict';

/* ── Config ── */
const LANG = 'fr';
const API  = `https://${LANG}.wikipedia.org/api/rest_v1`;
const MW   = `https://${LANG}.wikipedia.org/w/api.php`;

/* ─────────────────────────────────────────────────────────────
   MODES & CATÉGORIES
   Chaque mode a une liste de catégories Wikipedia précises.
   On tire une catégorie au hasard puis un article au hasard dedans.
   ───────────────────────────────────────────────────────────── */
const MODES = {
  classic: {
    label: '🎲 Classique',
    fetch: () => Promise.all([fetchRandom(), fetchRandom()]),
  },
  animals: {
    label: '🐾 Animaux',
    categories: [
      'Mammifère', 'Félins', 'Canidés', 'Primates', 'Cétacés',
      'Oiseaux_de_proie', 'Reptile', 'Amphibiens', 'Requins',
      'Insecte', 'Araignée', 'Serpent', 'Poissons', 'Ours',
      'Cervidés', 'Bovins', 'Équidés', 'Pingouins_et_manchots',
    ],
  },
  places: {
    label: '🌍 Lieux',
    categories: [
      'Capitale', 'Ville_de_France',
      'Île', 'Île_de_France_(région)',
      'Montagne', 'Sommet_des_Alpes', 'Sommet_des_Pyrénées',
      'Lac', 'Fleuve', 'Rivière_de_France',
      'Désert', 'Forêt', 'Parc_national',
      'Pays_d\'Europe', 'Pays_d\'Afrique', 'Pays_d\'Asie',
      'Pays_d\'Amérique', 'Pays_d\'Océanie',
      'Région_française', 'Département_français',
      'Mer', 'Océan', 'Golfe', 'Cap',
      'Volcan', 'Grotte',
    ],
  },
  people: {
    label: '👤 Personnages',
    categories: [
      'Acteur_français', 'Actrice_française',
      'Acteur_américain', 'Actrice_américaine',
      'Chanteur_français', 'Chanteuse_française',
      'Footballeur_français', 'Footballeuse_française',
      'Tennisman_français', 'Tenniswoman_française',
      'Nageur_français',
      'Politicien_français', 'Femme_politique_française',
      'Peintre_français', 'Sculpteur_français',
      'Réalisateur_français', 'Réalisatrice_française',
      'Écrivain_français', 'Romancière_française',
      'Physicien_français', 'Mathématicien_français',
      'Cuisinier_français',
      'Joueur_de_tennis_de_table_français',
      'Coureur_cycliste_français',
      'Boxeur_français',
    ],
  },
};

/* ─────────────────────────────────────────────────────────────
   FILTRES DE QUALITÉ
   ───────────────────────────────────────────────────────────── */

/** Titres à rejeter (prefixes & patterns) */
const BAD_TITLE_PREFIXES = [
  'Liste', 'Portail', 'Catégorie', 'Modèle', 'Projet',
  'Aide', 'Wikipédia', 'Discussion', 'Fichier',
];

const BAD_TITLE_PATTERNS = [
  /\(homonymie\)/i,
  /\(page d.ambiguïté\)/i,
  /^Liste/i,
  /\bindex\b/i,
  /\bglossaire\b/i,
  /^Annexe/i,
];

/** Extracts à rejeter : trop courts ou stub "X est un Y qui…" sans substance */
const MIN_EXTRACT_LEN = 120; // caractères

/** Descriptions à rejeter : philosophes du genre "Philosophe est un penseur qui…" */
const BAD_DESCRIPTION_PATTERNS = [
  /^un[e]? \w+ est /i,
  /^le \w+ est /i,
  /^la \w+ est /i,
  /désambiguïsation/i,
  /page d.homonymie/i,
];

/** Vérifie qu'une page est acceptable */
function isGoodPage(page) {
  if (!page || !page.title) return false;

  // Titre
  for (const prefix of BAD_TITLE_PREFIXES) {
    if (page.title.startsWith(prefix)) return false;
  }
  for (const rx of BAD_TITLE_PATTERNS) {
    if (rx.test(page.title)) return false;
  }

  // Description
  if (page.description) {
    for (const rx of BAD_DESCRIPTION_PATTERNS) {
      if (rx.test(page.description)) return false;
    }
  }

  // Extract trop court = stub
  if (!page.extract || page.extract.length < MIN_EXTRACT_LEN) return false;

  return true;
}

/* ─────────────────────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────────────────────── */
let state = {
  pages:     [null, null],
  chosen:    false,
  chosenIdx: -1,
  history:   [],
  mode:      'classic',
};

/* ─────────────────────────────────────────────────────────────
   DOM REFS
   ───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   THEME
   ───────────────────────────────────────────────────────────── */
(function initTheme() {
  const saved     = localStorage.getItem('tp-theme');
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', saved || preferred);
})();

$themeBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('tp-theme', next);
});

/* ─────────────────────────────────────────────────────────────
   MODE SELECTOR
   ───────────────────────────────────────────────────────────── */
$modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (state.mode === btn.dataset.mode) return;
    state.mode = btn.dataset.mode;
    $modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadRound();
  });
});

/* ─────────────────────────────────────────────────────────────
   DRAWER
   ───────────────────────────────────────────────────────────── */
function openDrawer()  {
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

/* ─────────────────────────────────────────────────────────────
   WIKIPEDIA FETCHERS
   ───────────────────────────────────────────────────────────── */

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

async function fetchSummaryByTitle(title) {
  const r = await fetch(`${API}/page/summary/${encodeURIComponent(title)}`);
  if (!r.ok) return null;
  return parseSummary(await r.json());
}

async function fetchRandom() {
  const r = await fetch(`${API}/page/random/summary`);
  if (!r.ok) return null;
  const page = parseSummary(await r.json());
  return isGoodPage(page) ? page : null;
}

/**
 * Tire aléatoirement un bon article depuis une liste de catégories.
 * Jusqu'à MAX_CAT_RETRIES tentatives de catégorie différentes.
 */
const MAX_CAT_RETRIES = 6;
const MAX_PAGE_RETRIES = 4;

async function fetchFromCategories(categories) {
  for (let catTry = 0; catTry < MAX_CAT_RETRIES; catTry++) {
    const cat = categories[Math.floor(Math.random() * categories.length)];

    const url = `${MW}?action=query&list=categorymembers`
      + `&cmtitle=${encodeURIComponent('Catégorie:' + cat)}`
      + `&cmlimit=80&cmtype=page&format=json&origin=*`;

    let members;
    try {
      const r = await fetch(url);
      const d = await r.json();
      members = d.query?.categorymembers || [];
    } catch {
      continue;
    }

    // Filtre primaire sur les titres (rapide, sans fetch)
    const filtered = members.filter(m => {
      for (const prefix of BAD_TITLE_PREFIXES) {
        if (m.title.startsWith(prefix)) return false;
      }
      for (const rx of BAD_TITLE_PATTERNS) {
        if (rx.test(m.title)) return false;
      }
      return true;
    });

    if (filtered.length === 0) continue;

    // Mélange et tente jusqu'à MAX_PAGE_RETRIES pages
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(MAX_PAGE_RETRIES, shuffled.length); i++) {
      const page = await fetchSummaryByTitle(shuffled[i].title);
      if (page && isGoodPage(page)) return page;
    }
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   FETCH PAIR selon le mode
   Retourne toujours [pageA, pageB] ou [fallback, fallback].
   Chaque slot réessaie jusqu'à MAX_SLOT_RETRIES fois.
   ───────────────────────────────────────────────────────────── */
const MAX_SLOT_RETRIES = 8;

async function fetchOneGoodPage(mode) {
  const modeConf = MODES[mode];

  for (let i = 0; i < MAX_SLOT_RETRIES; i++) {
    let page;

    if (mode === 'classic') {
      page = await fetchRandom();
    } else {
      page = await fetchFromCategories(modeConf.categories);
    }

    if (page && isGoodPage(page)) return page;
  }

  return fallbackPage();
}

async function fetchPair() {
  const [a, b] = await Promise.all([
    fetchOneGoodPage(state.mode),
    fetchOneGoodPage(state.mode),
  ]);
  return [a, b];
}

function fallbackPage() {
  return {
    title:       'Article indisponible',
    description: '',
    extract:     '.',
    image:       null,
    url:         `https://${LANG}.wikipedia.org`,
  };
}

/* ─────────────────────────────────────────────────────────────
   ROUND
   ───────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   ARENA
   ───────────────────────────────────────────────────────────── */
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
  const card = document.createElement('article');
  card.className = 'card';
  card.id = `card-${idx}`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Choisir : ${page.title}`);

  // Description courte : préférer description Wikipedia (≤ 80 car) sinon début d'extract
  const snippet = (page.description && page.description.length < 120)
    ? page.description
    : page.extract.slice(0, 160).replace(/\s+\S*$/, '') + '…';

  card.innerHTML = `
    ${page.image
      ? `<div class="card-img-wrap"><img class="card-img" src="${page.image}" alt="" loading="lazy"></div>`
      : `<div class="card-img-wrap card-img-placeholder"><span aria-hidden="true">📄</span></div>`
    }
    <div class="card-body">
      <div class="card-title">${escapeHtml(page.title)}</div>
      ${snippet ? `<div class="card-snippet">${escapeHtml(snippet)}</div>` : ''}
      <div class="card-footer">
        <a class="wiki-btn" href="${page.url}" target="_blank" rel="noopener noreferrer"
           onclick="event.stopPropagation()">↗ Wikipedia</a>
      </div>
    </div>
  `;

  card.addEventListener('click', () => choose(idx));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(idx); }
  });

  return card;
}

/* ─────────────────────────────────────────────────────────────
   CHOICE
   ───────────────────────────────────────────────────────────── */
function choose(idx) {
  if (state.chosen && state.chosenIdx === idx) return;

  const wasChosen  = state.chosen;
  state.chosen     = true;
  state.chosenIdx  = idx;

  const cardA  = document.getElementById('card-0');
  const cardB  = document.getElementById('card-1');
  const winner = idx === 0 ? cardA : cardB;
  const loser  = idx === 0 ? cardB : cardA;

  winner.classList.add('winner');
  winner.classList.remove('loser');
  loser.classList.add('loser');
  loser.classList.remove('winner');

  $btnNext.disabled = false;

  const entry = {
    winner: state.pages[idx].title,
    loser:  state.pages[1 - idx].title,
    mode:   state.mode,
  };

  if (!wasChosen) state.history.unshift(entry);
  else            state.history[0] = entry;

  renderHistory();
}

/* ─────────────────────────────────────────────────────────────
   HISTORY
   ───────────────────────────────────────────────────────────── */
const MODE_ICONS = { classic: '🎲', animals: '🐾', places: '🌍', people: '👤' };

function renderHistory() {
  const h = state.history;
  $histCount.textContent = `${h.length} choix`;
  if ($histEmpty) $histEmpty.style.display = h.length ? 'none' : 'block';

  $histList.innerHTML = h.slice(0, 60).map(entry => `
    <li class="history-item">
      <span class="h-icon" title="${entry.mode}">${MODE_ICONS[entry.mode] || '·'}</span>
      <span class="h-winner">${escapeHtml(entry.winner)}</span>
      <span class="h-vs">ou</span>
      <span class="h-loser">${escapeHtml(entry.loser)}</span>
    </li>
  `).join('');
}

/* ─────────────────────────────────────────────────────────────
   CONTROLS
   ───────────────────────────────────────────────────────────── */
$btnNext.addEventListener('click', () => { if (state.chosen) loadRound(); });

$btnReset.addEventListener('click', () => {
  state.history = [];
  $histCount.textContent = '0 choix';
  $histList.innerHTML    = '';
  if ($histEmpty) $histEmpty.style.display = 'block';
  loadRound();
});

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowRight' && !$btnNext.disabled) loadRound();
  if (e.key === '1') choose(0);
  if (e.key === '2') choose(1);
});

/* ─────────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ─────────────────────────────────────────────────────────────
   BOOT
   ───────────────────────────────────────────────────────────── */
loadRound();
