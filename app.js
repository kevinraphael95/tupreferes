/* ============================================================
   TU PRÉFÈRES — Application Logic
   ============================================================ */

'use strict';

/* ── Config ── */
const LANG = 'fr';
const API  = `https://${LANG}.wikipedia.org/api/rest_v1`;
const MW   = `https://${LANG}.wikipedia.org/w/api.php`;
const WD   = 'https://www.wikidata.org/w/api.php';

/* ─────────────────────────────────────────────────────────────
   WIKIDATA — QIDs acceptés par mode (P31 = instance de)
   ───────────────────────────────────────────────────────────── */
const WD_TYPES = {
  animals: new Set([
    'Q16521',    // taxon (couvre toutes les espèces biologiques)
    'Q729',      // animal
    'Q7432',     // espèce
    'Q38829',    // genre biologique
    'Q23038290', // taxon fossile
    'Q310890',   // sous-espèce
    'Q68947',    // sous-genre
  ]),
  places: new Set([
    'Q515',      // ville
    'Q532',      // village
    'Q6256',     // pays
    'Q3455524',  // État souverain
    'Q35657',    // état américain
    'Q36784',    // région française
    'Q6465',     // département français
    'Q484170',   // commune française
    'Q23442',    // île
    'Q8502',     // montagne
    'Q46831',    // chaîne de montagnes
    'Q23397',    // lac
    'Q4022',     // rivière / fleuve
    'Q9430',     // océan
    'Q37320',    // mer
    'Q35509',    // grotte
    'Q131681',   // volcan
    'Q22698',    // parc national
    'Q46169',    // cap
    'Q35872',    // détroit
    'Q43197',    // désert (spécifique)
    'Q179049',   // forêt (spécifique)
    'Q15324',    // continent
    'Q56061',    // entité territoriale administrative
    'Q15304953', // subdivision pays
    'Q82794',    // région géographique
    'Q41176',    // bâtiment — exclu
  ]),
  people: new Set([
    'Q5',        // être humain — seul QID qui compte
  ]),
};

/* ─────────────────────────────────────────────────────────────
   CATÉGORIES Wikipedia par mode
   Servent uniquement de point d'entrée pour trouver des articles.
   Wikidata valide ensuite que c'est bien le bon type.
   ───────────────────────────────────────────────────────────── */
const MODES = {
  classic: { label: '🎲 Classique' },

  animals: {
    label: '🐾 Animaux',
    categories: [
      // Groupes taxonomiques larges — leurs membres sont des espèces
      'Espèce_de_mammifères',
      'Espèce_d\'oiseaux',
      'Espèce_de_reptiles',
      'Espèce_d\'amphibiens',
      'Espèce_de_poissons',
      'Espèce_d\'insectes',
      'Espèce_d\'araignées',
      'Espèce_de_mollusques',
      'Espèce_de_crustacés',
      // Groupes populaires bien fournis
      'Félins',
      'Canidés',
      'Primates',
      'Cétacés',
      'Requins',
      'Ursidés',
      'Cervidés',
      'Bovins',
      'Équidés',
      'Pingouins_et_manchots',
      'Perroquets',
      'Rapaces',
      'Serpents',
      'Crocodiliens',
      'Chéloniens',
      'Lézards',
    ],
  },

  places: {
    label: '🌍 Lieux',
    categories: [
      // Pays
      'Pays_d\'Europe', 'Pays_d\'Afrique',
      'Pays_d\'Asie', 'Pays_d\'Amérique', 'Pays_d\'Océanie',
      // Villes
      'Ville_de_plus_de_100_000_habitants_en_France',
      'Capitale_en_Europe', 'Capitale_en_Afrique',
      'Capitale_en_Asie', 'Capitale_en_Amérique',
      // Admin française
      'Région_française', 'Département_français',
      // Montagnes
      'Sommet_des_Alpes', 'Sommet_des_Pyrénées',
      'Sommet_de_l\'Himalaya', 'Sommet_des_Andes',
      'Volcan_actif',
      // Îles
      'Île_de_la_Méditerranée', 'Île_de_l\'Atlantique',
      'Île_du_Pacifique', 'Île_de_l\'océan_Indien',
      // Eaux
      'Fleuve_d\'Europe', 'Fleuve_d\'Afrique',
      'Fleuve_d\'Asie', 'Fleuve_d\'Amérique',
      'Lac_d\'Europe', 'Lac_d\'Afrique',
      // Divers
      'Parc_national_en_France', 'Parc_national_en_Afrique',
      'Parc_national_aux_États-Unis',
      'Détroit', 'Cap',
      'Grotte_en_France',
    ],
  },

  people: {
    label: '👤 Personnages',
    categories: [
      'Acteur_français', 'Actrice_française',
      'Acteur_américain', 'Actrice_américaine',
      'Chanteur_français', 'Chanteuse_française',
      'Chanteur_américain', 'Chanteuse_américaine',
      'Footballeur_français', 'Footballeur_espagnol',
      'Footballeur_brésilien', 'Footballeuse_française',
      'Tennisman_français', 'Tenniswoman_française',
      'Nageur_français', 'Cycliste_français',
      'Boxeur_français', 'Judoka_français',
      'Politicien_français', 'Femme_politique_française',
      'Président_de_la_République_française',
      'Peintre_français', 'Sculpteur_français',
      'Réalisateur_français', 'Réalisatrice_française',
      'Réalisateur_américain',
      'Écrivain_français', 'Romancier_français',
      'Physicien_français', 'Mathématicien_français',
      'Cuisinier_français', 'Chef_cuisinier_français',
      'Musicien_français', 'Compositeur_français',
      'Philosophe_français', 'Architecte_français',
    ],
  },
};

/* ─────────────────────────────────────────────────────────────
   FILTRES TITRE / DESCRIPTION (rapides, sans réseau)
   ───────────────────────────────────────────────────────────── */
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

const MIN_EXTRACT_LEN = 150;

const BAD_DESCRIPTION_PATTERNS = [
  /désambiguïsation/i,
  /page d.homonymie/i,
];

function isTitleOk(title) {
  for (const p of BAD_TITLE_PREFIXES) if (title.startsWith(p)) return false;
  for (const r of BAD_TITLE_PATTERNS) if (r.test(title)) return false;
  return true;
}

function isPageOk(page) {
  if (!page?.title) return false;
  if (!isTitleOk(page.title)) return false;
  if (page.description) {
    for (const r of BAD_DESCRIPTION_PATTERNS) if (r.test(page.description)) return false;
  }
  if (!page.extract || page.extract.length < MIN_EXTRACT_LEN) return false;
  return true;
}

/* ─────────────────────────────────────────────────────────────
   WIKIDATA — Validation du type
   2 requêtes : QID puis P31 (instance de)
   ───────────────────────────────────────────────────────────── */
const wdCache = new Map(); // titre → bool par mode

async function wikidataValidate(page, mode) {
  if (mode === 'classic') return true;
  const types = WD_TYPES[mode];
  if (!types) return true;

  const cacheKey = `${mode}:${page.title}`;
  if (wdCache.has(cacheKey)) return wdCache.get(cacheKey);

  try {
    // 1. Récupérer le QID via l'API Wikipedia
    const r1 = await fetch(
      `${MW}?action=query&titles=${encodeURIComponent(page.title)}`
      + `&prop=pageprops&ppprop=wikibase_item&format=json&origin=*`
    );
    const d1  = await r1.json();
    const qid = Object.values(d1.query?.pages || {})[0]?.pageprops?.wikibase_item;
    if (!qid) { wdCache.set(cacheKey, false); return false; }

    // 2. Récupérer P31 (instance de) depuis Wikidata
    const r2 = await fetch(
      `${WD}?action=wbgetclaims&entity=${qid}&property=P31&format=json&origin=*`
    );
    const d2     = await r2.json();
    const claims = d2.claims?.P31 || [];
    const qids   = new Set(claims.map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean));

    let ok = false;
    for (const q of qids) {
      if (types.has(q)) { ok = true; break; }
    }

    wdCache.set(cacheKey, ok);
    return ok;
  } catch {
    // En cas d'erreur réseau on laisse passer pour ne pas bloquer
    return true;
  }
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
  try {
    const r = await fetch(`${API}/page/summary/${encodeURIComponent(title)}`);
    if (!r.ok) return null;
    return parseSummary(await r.json());
  } catch { return null; }
}

async function fetchRandom() {
  try {
    const r = await fetch(`${API}/page/random/summary`);
    if (!r.ok) return null;
    return parseSummary(await r.json());
  } catch { return null; }
}

/* ─────────────────────────────────────────────────────────────
   FETCH DEPUIS CATÉGORIES
   ───────────────────────────────────────────────────────────── */
const MAX_CAT_RETRIES  = 8;
const MAX_PAGE_RETRIES = 5;

async function fetchFromCategories(categories, mode) {
  for (let catTry = 0; catTry < MAX_CAT_RETRIES; catTry++) {
    const cat = categories[Math.floor(Math.random() * categories.length)];

    let members;
    try {
      const r = await fetch(
        `${MW}?action=query&list=categorymembers`
        + `&cmtitle=${encodeURIComponent('Catégorie:' + cat)}`
        + `&cmlimit=80&cmtype=page&format=json&origin=*`
      );
      const d = await r.json();
      members = d.query?.categorymembers || [];
    } catch { continue; }

    // Filtre rapide sur les titres
    const filtered = members.filter(m => isTitleOk(m.title));
    if (filtered.length === 0) continue;

    // Mélange aléatoire
    const shuffled = [...filtered].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(MAX_PAGE_RETRIES, shuffled.length); i++) {
      const page = await fetchSummaryByTitle(shuffled[i].title);
      if (!page || !isPageOk(page)) continue;

      // Validation Wikidata — détermine si c'est vraiment le bon type
      const valid = await wikidataValidate(page, mode);
      if (valid) return page;
    }
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   FETCH UN BON ARTICLE pour le mode courant
   ───────────────────────────────────────────────────────────── */
const MAX_SLOT_RETRIES = 6;

async function fetchOneGoodPage(mode) {
  const modeConf = MODES[mode];

  for (let i = 0; i < MAX_SLOT_RETRIES; i++) {
    let page;

    if (mode === 'classic') {
      page = await fetchRandom();
      if (page && isPageOk(page)) return page;
    } else {
      page = await fetchFromCategories(modeConf.categories, mode);
      if (page) return page;
    }
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
  wdCache.clear();
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
