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
  },
  animals: {
    label: '🐾 Animaux',
    // Catégories d'espèces animales nommées — pas de catégories génériques
    // qui contiennent des musées, associations, etc.
    categories: [
      // Mammifères
      'Lion', 'Tigre', 'Léopard', 'Guépard', 'Jaguar',
      'Loup', 'Renard', 'Ours_brun', 'Ours_polaire', 'Panda_géant',
      'Éléphant_d\'Afrique', 'Éléphant_d\'Asie',
      'Girafe', 'Hippopotame', 'Rhinocéros',
      'Gorille', 'Chimpanzé', 'Orang-outan', 'Babouin',
      'Dauphin', 'Orque', 'Baleine_bleue', 'Cachalot',
      'Zèbre', 'Cheval', 'Âne',
      'Cerf_élaphe', 'Renne', 'Élan',
      'Lama', 'Alpaga', 'Chameau', 'Dromadaire',
      'Kangourou', 'Koala', 'Wombat', 'Wallaby',
      'Lynx', 'Puma', 'Coyote', 'Hyène',
      'Phoque', 'Morse', 'Lion_de_mer',
      // Oiseaux
      'Aigle_royal', 'Condor_des_Andes', 'Faucon_pèlerin',
      'Manchot_empereur', 'Autruche', 'Flamant_rose',
      'Perroquet', 'Toucan', 'Colibri',
      'Hibou_grand-duc', 'Cigogne_blanche',
      // Reptiles nommés
      'Crocodile_du_Nil', 'Anaconda', 'Python_réticulé',
      'Tortue_géante_des_Galápagos', 'Varan_de_Komodo',
      'Caméléon', 'Gecko',
      // Poissons & marins
      'Grand_requin_blanc', 'Requin_baleine',
      'Pieuvre', 'Méduse', 'Étoile_de_mer',
      'Hippocampe', 'Poisson_clown',
      // Insectes / arthropodes nommés
      'Papillon_monarque', 'Abeille_mellifère', 'Mante_religieuse',
      'Scarabée', 'Coccinelle',
    ],
    // Filtre supplémentaire : la description doit évoquer un être vivant
    extraFilter: page => {
      const text = (page.description + ' ' + page.extract).toLowerCase();
      const animalWords = [
        'espèce', 'animal', 'mammifère', 'oiseau', 'reptile', 'poisson',
        'insecte', 'amphibien', 'carnivore', 'herbivore', 'primate',
        'félin', 'canidé', 'cétacé', 'requin', 'serpent', 'lézard',
        'araignée', 'papillon', 'abeille', 'genre', 'famille', 'ordre',
        'vertébré', 'invertébré', 'rongeur', 'rapace', 'passereau',
      ];
      return animalWords.some(w => text.includes(w));
    },
  },
  places: {
    label: '🌍 Lieux',
    // Uniquement des catégories de lieux NOMMÉS et spécifiques
    categories: [
      // Villes & capitales
      'Capitale_en_Europe', 'Capitale_en_Afrique',
      'Capitale_en_Asie', 'Capitale_en_Amérique',
      'Ville_de_plus_de_100_000_habitants_en_France',
      'Commune_de_Paris',
      // Îles nommées
      'Île_de_la_Méditerranée', 'Île_de_l\'Atlantique',
      'Île_du_Pacifique', 'Île_de_l\'océan_Indien',
      // Montagnes nommées
      'Sommet_des_Alpes', 'Sommet_des_Pyrénées',
      'Sommet_de_l\'Himalaya', 'Sommet_des_Andes',
      'Volcan_actif',
      // Cours d\'eau nommés
      'Fleuve_d\'Europe', 'Fleuve_d\'Afrique',
      'Fleuve_d\'Asie', 'Fleuve_d\'Amérique',
      'Lac_d\'Europe', 'Lac_d\'Afrique', 'Lac_d\'Amérique',
      // Pays
      'Pays_d\'Europe', 'Pays_d\'Afrique',
      'Pays_d\'Asie', 'Pays_d\'Amérique',
      'Pays_d\'Océanie',
      // Régions administratives
      'Région_française', 'Département_français',
      'Province_du_Canada', 'État_des_États-Unis',
      // Parcs & sites naturels
      'Parc_national_en_France', 'Parc_national_en_Afrique',
      'Parc_national_aux_États-Unis',
      'Site_du_patrimoine_mondial_en_France',
      // Mers & océans
      'Mer', 'Détroit',
      // Grottes & canyon
      'Grotte_en_France', 'Canyon',
    ],
    // Filtre : titre doit ressembler à un nom propre (contient une majuscule non initiale
    // OU description évoque un lieu géographique)
    extraFilter: page => {
      // Rejette les pages dont le titre est un nom commun simple (1 mot, tout en minuscules sauf 1ère lettre)
      if (/^[A-ZÀÂÉÈÊÙÛÎÏÔŒÆÇ][a-zàâéèêùûîïôœæç]+$/.test(page.title)) {
        // Un seul mot au style "Désert", "Forêt", "Mer" → concept générique probable
        // On accepte si la description mentionne un lieu précis
        const desc = page.description.toLowerCase();
        const placeWords = ['situé', 'située', 'en france', 'en afrique', 'en asie',
          'dans le', 'dans la', 'au ', 'département', 'commune', 'ville', 'île',
          'fleuve', 'lac', 'montagne', 'volcan', 'pays', 'région', 'province'];
        return placeWords.some(w => desc.includes(w));
      }
      return true;
    },
  },
  people: {
    label: '👤 Personnages',
    categories: [
      'Acteur_français', 'Actrice_française',
      'Acteur_américain', 'Actrice_américaine',
      'Chanteur_français', 'Chanteuse_française',
      'Chanteur_américain', 'Chanteuse_américaine',
      'Footballeur_français', 'Footballeuse_française',
      'Footballeur_espagnol', 'Footballeur_brésilien',
      'Tennisman_français', 'Tenniswoman_française',
      'Nageur_français', 'Cycliste_français',
      'Boxeur_français', 'Judoka_français',
      'Politicien_français', 'Femme_politique_française',
      'Président_de_la_République_française',
      'Peintre_français', 'Sculpteur_français',
      'Réalisateur_français', 'Réalisatrice_française',
      'Réalisateur_américain', 'Réalisatrice_américaine',
      'Écrivain_français', 'Romancier_français',
      'Physicien_français', 'Mathématicien_français',
      'Biologiste_français', 'Médecin_français',
      'Cuisinier_français', 'Chef_cuisinier_français',
      'Musicien_français', 'Compositeur_français',
      'Philosophe_français',
      'Architecte_français',
      'Photographe_français',
    ],
    // Filtre : la description doit indiquer une personne (né, mort, nationalité…)
    extraFilter: page => {
      const desc = page.description.toLowerCase();
      const personWords = [
        'né', 'née', 'mort', 'morte', 'décédé', 'décédée',
        'français', 'française', 'américain', 'américaine',
        'acteur', 'actrice', 'chanteur', 'chanteuse',
        'footballeur', 'joueur', 'joueuse', 'réalisateur', 'réalisatrice',
        'écrivain', 'romancier', 'peintre', 'sculpteur', 'musicien',
        'politicien', 'homme politique', 'femme politique',
        'physicien', 'mathématicien', 'biologiste', 'médecin',
        'chef', 'cuisinier', 'architecte', 'photographe',
        'philosophe', 'compositeur', 'nageur',
      ];
      return personWords.some(w => desc.includes(w));
    },
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

/**
 * Vérifie qu'une page est acceptable.
 * @param {object} page
 * @param {function|null} extraFilter  Filtre supplémentaire lié au mode
 */
function isGoodPage(page, extraFilter = null) {
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

  // Filtre spécifique au mode
  if (extraFilter && !extraFilter(page)) return false;

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

async function fetchFromCategories(categories, extraFilter = null) {
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
      if (page && isGoodPage(page, extraFilter)) return page;
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
  const modeConf  = MODES[mode];
  const extraFilter = modeConf.extraFilter || null;

  for (let i = 0; i < MAX_SLOT_RETRIES; i++) {
    let page;

    if (mode === 'classic') {
      page = await fetchRandom();
    } else {
      page = await fetchFromCategories(modeConf.categories, extraFilter);
    }

    if (page && isGoodPage(page, extraFilter)) return page;
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
