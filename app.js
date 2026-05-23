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
   WIKIDATA — QIDs P31 (instance de) acceptés par mode
   ───────────────────────────────────────────────────────────── */
const WD_TYPES = {
  animals: new Set([
    'Q729',      // animal
    'Q7432',     // espèce
    'Q310890',   // sous-espèce
    'Q4886',     // race (animale)
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
    'Q43197',    // désert (lieu)
    'Q179049',   // forêt (lieu)
    'Q15324',    // continent
    'Q56061',    // entité territoriale
    'Q15304953', // subdivision pays
    'Q82794',    // région géographique
    'Q1620908',  // île principale
    'Q33742',    // île naturelle
    'Q1637706',  // ville millionnaire
    'Q200250',   // massif
    'Q355304',   // cours d'eau
    'Q131669',   // canyon
    'Q39816',    // vallée
    'Q165',      // mer
    'Q34763',    // péninsule
    'Q1428',     // baie
  ]),
  people: new Set([
    'Q5',        // être humain — seul QID valide
  ]),
};

/* ─────────────────────────────────────────────────────────────
   CATÉGORIES Wikipedia par mode
   ───────────────────────────────────────────────────────────── */
const MODES = {
  classic: { label: '🎲 Classique' },

  animals: {
    label: '🐾 Animaux',
    categories: [
      'Espèce_de_mammifères',
      'Espèce_d\'oiseaux',
      'Espèce_de_reptiles',
      'Espèce_d\'amphibiens',
      'Espèce_de_poissons',
      'Espèce_d\'insectes',
      'Espèce_d\'araignées',
      'Espèce_de_mollusques',
      'Espèce_de_crustacés',
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
      'Pays_d\'Europe', 'Pays_d\'Afrique',
      'Pays_d\'Asie', 'Pays_d\'Amérique', 'Pays_d\'Océanie',
      'Ville_de_plus_de_100_000_habitants_en_France',
      'Capitale_en_Europe', 'Capitale_en_Afrique',
      'Capitale_en_Asie', 'Capitale_en_Amérique',
      'Région_française', 'Département_français',
      'Sommet_des_Alpes', 'Sommet_des_Pyrénées',
      'Sommet_de_l\'Himalaya', 'Sommet_des_Andes',
      'Volcan_actif',
      'Île_de_la_Méditerranée', 'Île_de_l\'Atlantique',
      'Île_du_Pacifique', 'Île_de_l\'océan_Indien',
      'Fleuve_d\'Europe', 'Fleuve_d\'Afrique',
      'Fleuve_d\'Asie', 'Fleuve_d\'Amérique',
      'Lac_d\'Europe', 'Lac_d\'Afrique',
      'Parc_national_en_France', 'Parc_national_en_Afrique',
      'Parc_national_aux_États-Unis',
      'Détroit', 'Cap', 'Grotte_en_France',
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
   FILTRES RAPIDES (sans réseau)
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

function isTitleOk(title) {
  for (const p of BAD_TITLE_PREFIXES) if (title.startsWith(p)) return false;
  for (const r of BAD_TITLE_PATTERNS) if (r.test(title)) return false;
  return true;
}

function isPageOk(page) {
  if (!page?.title) return false;
  if (!isTitleOk(page.title)) return false;
  if (/désambiguïsation|page d.homonymie/i.test(page.description)) return false;
  if (!page.extract || page.extract.length < MIN_EXTRACT_LEN) return false;
  return true;
}

/* ─────────────────────────────────────────────────────────────
   WIKIDATA — Validation via P31 (instance de)
   Cache en mémoire pour éviter les doublons de requêtes.
   Permissif en cas d'erreur réseau (on laisse passer).
   ───────────────────────────────────────────────────────────── */
const wdCache = new Map(); // `mode:title` → true | false

async function wikidataValidate(page, mode) {
  if (mode === 'classic') return true;
  const types = WD_TYPES[mode];
  if (!types) return true;

  const key = `${mode}:${page.title}`;
  if (wdCache.has(key)) return wdCache.get(key);

  try {
    // 1. QID de l'article Wikipedia FR
    const r1  = await fetch(
      `${MW}?action=query&titles=${encodeURIComponent(page.title)}`
      + `&prop=pageprops&ppprop=wikibase_item&format=json&origin=*`
    );
    const d1  = await r1.json();
    const qid = Object.values(d1.query?.pages || {})[0]?.pageprops?.wikibase_item;

    // Pas de QID = article Wikidata-less, on accepte plutôt que de bloquer
    if (!qid) { wdCache.set(key, true); return true; }

    // 2. P31 (instance de) depuis Wikidata
    const r2     = await fetch(
      `${WD}?action=wbgetclaims&entity=${qid}&property=P31&format=json&origin=*`
    );
    const d2     = await r2.json();
    const claims = d2.claims?.P31 || [];
    const qids   = new Set(claims.map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean));

    // Pas de P31 = article mal typé, on accepte plutôt que de bloquer
    if (qids.size === 0) { wdCache.set(key, true); return true; }

    let ok = false;
    for (const q of qids) {
      if (types.has(q)) { ok = true; break; }
    }

    wdCache.set(key, ok);
    return ok;
  } catch {
    // Erreur réseau → on laisse passer pour ne jamais bloquer
    wdCache.set(key, true);
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
  seen:      new Set(), // titres déjà montrés cette session
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
    state.seen.clear();
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
   FETCH DEPUIS CATÉGORIES — avec validation Wikidata
   ───────────────────────────────────────────────────────────── */
const MAX_CAT_RETRIES  = 10;
const MAX_PAGE_RETRIES = 6;

async function fetchFromCategories(categories, mode) {
  for (let catTry = 0; catTry < MAX_CAT_RETRIES; catTry++) {
    const cat = categories[Math.floor(Math.random() * categories.length)];

    let members;
    try {
      const r = await fetch(
        `${MW}?action=query&list=categorymembers`
        + `&cmtitle=${encodeURIComponent('Catégorie:' + cat)}`
        + `&cmlimit=100&cmtype=page&format=json&origin=*`
      );
      const d = await r.json();
      members = d.query?.categorymembers || [];
    } catch { continue; }

    // Filtre rapide + dédup session
    const filtered = members.filter(m =>
      isTitleOk(m.title) && !state.seen.has(m.title)
    );
    if (filtered.length === 0) continue;

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(MAX_PAGE_RETRIES, shuffled.length); i++) {
      const page = await fetchSummaryByTitle(shuffled[i].title);
      if (!page || !isPageOk(page) || state.seen.has(page.title)) continue;

      const valid = await wikidataValidate(page, mode);
      if (valid) return page;
    }
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   FETCH LA PAIRE — deux articles différents en parallèle
   ───────────────────────────────────────────────────────────── */
async function fetchOneGoodPage(mode, exclude = null) {
  const modeConf = MODES[mode];
  const MAX = 8;

  for (let i = 0; i < MAX; i++) {
    let page;

    if (mode === 'classic') {
      page = await fetchRandom();
      if (!page || !isPageOk(page)) continue;
    } else {
      page = await fetchFromCategories(modeConf.categories, mode);
    }

    if (!page) continue;
    // Pas le même que l'autre carte
    if (exclude && page.title === exclude) continue;
    // Pas déjà vu cette session
    if (state.seen.has(page.title)) continue;

    return page;
  }

  return null; // on n'affiche rien plutôt qu'un fallback trompeur
}

async function fetchPair() {
  // On fetch A d'abord, puis B en excluant le titre de A
  const a = await fetchOneGoodPage(state.mode);
  const b = await fetchOneGoodPage(state.mode, a?.title ?? null);
  return [a, b];
}

/* ─────────────────────────────────────────────────────────────
   ROUND
   ───────────────────────────────────────────────────────────── */
async function loadRound() {
  state.chosen    = false;
  state.chosenIdx = -1;
  showLoader(true);
  $btnNext.disabled = true;

  const [a, b] = await fetchPair();

  // On enregistre les titres dans "seen" seulement si valides
  if (a?.title) state.seen.add(a.title);
  if (b?.title) state.seen.add(b.title);

  // Si seen devient énorme (> 300), on vide la moitié pour éviter de saturer
  if (state.seen.size > 300) {
    const arr = [...state.seen];
    state.seen = new Set(arr.slice(arr.length / 2));
  }

  state.pages = [
    a ?? fallbackPage(),
    b ?? fallbackPage(),
  ];

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
  state.seen.clear();
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
function fallbackPage() {
  return {
    title:       'Article indisponible',
    description: '',
    extract:     '.',
    image:       null,
    url:         `https://${LANG}.wikipedia.org`,
  };
}

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
