/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// tour-panel.js — panneau gauche : tableau des étapes + progression.
// Ouvert par « Sélectionner ce tour ». Affiche les étapes (numéro, ICAO
// départ/arrivée, distance nm), gère la progression persistée (fichier signé
// côté main, voir progress-store.js),
// l'état des lignes (courante / en cours / validée), le bouton
// « Commencer / Continuer le tour » et la zone de statut. Le suivi
// SimConnect proprement dit est dans sim-tracking.js (couplage par
// fonctions globales : getPanelTour, getCurrentLegIndex, markLegCompleted,
// setLegActive, highlightSelected, setStatus/setStatusKey, haversineNm).
// ============================================================

let panelTour = null; // tour affiché dans le panneau
let completed = new Set(); // indices d'étapes validées du tour courant
let currentIndex = 0; // étape courante (première non validée)
let selectedIndex = 0; // ligne surlignée « courante »
let statusRender = null; // fonction de rendu du statut (pour re-traduction)
let tourStarted = false; // « Commencer / Continuer le tour » a été cliqué
let legStats = {}; // { index: { sec, nm } } temps et distance réels par étape

// --- Géométrie ---------------------------------------------------------------

// Distance grand-cercle en milles nautiques.
function haversineNm(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // rayon terrestre moyen en NM
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function legDistanceNm(leg) {
  const a = toursData.airports[leg.from];
  const b = toursData.airports[leg.to];
  if (!a || !b) return null;
  return haversineNm(a.lat, a.lon, b.lat, b.lon);
}

// --- Progression persistée ---------------------------------------------------

// La progression vit dans un fichier signé côté process principal
// (progress-store.js). On en garde un instantané en mémoire, chargé au
// démarrage par initProgress(), pour que les lectures restent synchrones ;
// chaque écriture est répercutée dans le fichier via l'IPC.
//   progressCache.tours[id] = { completed: [i…], stats: { i: { sec, nm } } }
let progressCache = { tours: {} };

// Charge l'instantané et reprend une éventuelle progression de l'ancien
// stockage localStorage (versions antérieures de l'application).
async function initProgress() {
  await migrateLegacyProgress();
  const snap = await window.tours.progressGet();
  progressCache = { tours: (snap && snap.tours) || {} };
  return snap || { tours: {}, tampered: false };
}

async function migrateLegacyProgress() {
  const entries = {};
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('cavva:progress:')) keys.push(k);
  }
  for (const k of keys) {
    const tourId = k.slice('cavva:progress:'.length);
    try {
      entries[tourId] = {
        completed: JSON.parse(localStorage.getItem(k)) || [],
        stats: JSON.parse(localStorage.getItem('cavva:stats:' + tourId) || '{}'),
      };
    } catch (_) {
      /* entrée illisible : ignorée */
    }
  }
  if (!keys.length) return;
  await window.tours.progressImport(entries);
  keys.forEach((k) => {
    localStorage.removeItem(k);
    localStorage.removeItem('cavva:stats:' + k.slice('cavva:progress:'.length));
  });
}

function loadCompleted(tourId) {
  const e = progressCache.tours[tourId];
  return new Set((e && e.completed) || []);
}

// Statistiques réelles par étape validée : { "<index>": { sec, nm } }.
// Absentes pour les étapes validées avant l'ajout des statistiques.
function loadLegStats(tourId) {
  const e = progressCache.tours[tourId];
  return (e && e.stats) || {};
}

// Écrit la progression du tour courant (cache + fichier signé).
function persistProgress() {
  if (!panelTour) return;
  const entry = { completed: [...completed], stats: legStats };
  progressCache.tours[panelTour.id] = entry;
  window.tours.progressSet(panelTour.id, entry);
}

function firstUncompleted() {
  for (let i = 0; i < panelTour.legs.length; i++) if (!completed.has(i)) return i;
  return panelTour.legs.length; // tout validé
}

function getPanelTour() {
  return panelTour;
}
function getCurrentLegIndex() {
  return currentIndex;
}
function isTourComplete() {
  return panelTour ? currentIndex >= panelTour.legs.length : false;
}
// Le suivi d'étape n'est autorisé qu'après « Commencer / Continuer le tour ».
function isTourStarted() {
  return tourStarted;
}

// --- Statut ------------------------------------------------------------------

function setStatus(text) {
  statusRender = null;
  document.getElementById('simStatus').textContent = text || '';
}

function setStatusKey(key, params) {
  statusRender = () => tp(key, params);
  document.getElementById('simStatus').textContent = statusRender();
}

function refreshStatus() {
  if (statusRender) document.getElementById('simStatus').textContent = statusRender();
}

// --- Tableau -----------------------------------------------------------------

function renderTable() {
  const body = document.getElementById('legsBody');
  body.innerHTML = '';
  panelTour.legs.forEach((leg, i) => {
    const tr = document.createElement('tr');
    tr.dataset.index = String(i);
    const d = legDistanceNm(leg);
    tr.innerHTML =
      `<td class="num">${i + 1}</td>` +
      `<td>${leg.from}</td>` +
      `<td>${leg.to}</td>` +
      `<td class="num">${d == null ? '—' : d.toFixed(1)}</td>`;
    if (completed.has(i)) tr.classList.add('done');
    body.appendChild(tr);
  });
}

// Surligne l'étape courante (sélection légère), sauf si déjà validée.
function highlightSelected() {
  if (!panelTour) return;
  const rows = document.querySelectorAll('#legsBody tr');
  rows.forEach((r) => r.classList.remove('current', 'active'));
  if (selectedIndex < panelTour.legs.length && !completed.has(selectedIndex)) {
    const row = rows[selectedIndex];
    if (row) {
      row.classList.add('current');
      row.scrollIntoView({ block: 'nearest' });
    }
  }
}

// Surligne fortement l'étape en cours (suivi actif).
function setLegActive(index) {
  const rows = document.querySelectorAll('#legsBody tr');
  rows.forEach((r) => r.classList.remove('current', 'active'));
  const row = rows[index];
  if (row) {
    row.classList.add('active');
    row.scrollIntoView({ block: 'nearest' });
  }
}

// Passe une étape en « validée » (grisée) et fait avancer l'étape courante.
// stats (facultatif) : { sec, nm } réellement volés, pour « Badges et
// statistiques ».
function markLegCompleted(index, stats) {
  completed.add(index);
  if (stats) {
    legStats[index] = { sec: Math.round(stats.sec), nm: Math.round(stats.nm * 10) / 10 };
  }
  persistProgress();
  const row = document.querySelectorAll('#legsBody tr')[index];
  if (row) {
    row.classList.remove('active', 'current');
    row.classList.add('done');
  }
  currentIndex = firstUncompleted();
  selectedIndex = Math.min(currentIndex, panelTour.legs.length - 1);
  updateTourButton();
}

// --- Bouton « Commencer / Continuer le tour » --------------------------------

// Le libellé dépend de la progression ; le bouton se grise une fois cliqué
// (le tour est lancé, c'est au bouton d'étape de prendre le relais).
function updateTourButton() {
  const btn = document.getElementById('btnStartTour');
  const key = completed.size > 0 ? 'continueTour' : 'startTour';
  btn.dataset.i18n = key;
  btn.textContent = t(key);
  btn.disabled = tourStarted;
}

// --- Ouverture du panneau ----------------------------------------------------

function openTourPanel(tour) {
  // Stoppe proprement un éventuel suivi du tour précédent.
  if (typeof cancelTracking === 'function') cancelTracking(true);

  panelTour = tour;
  completed = loadCompleted(tour.id);
  legStats = loadLegStats(tour.id);
  currentIndex = firstUncompleted();
  selectedIndex = Math.min(currentIndex, tour.legs.length - 1);
  tourStarted = false;

  renderTable();
  updateTourButton();
  if (typeof resetLegButton === 'function') resetLegButton();
  setStatus('');

  document.getElementById('tourPanel').hidden = false;

  // La carte a rétréci (2/3) → recalcul des tuiles puis tracé/recentrage.
  requestAnimationFrame(() => {
    map.invalidateSize();
    drawTour(tour);
    highlightSelected();
  });
}
window.openTourPanel = openTourPanel;

function refreshTourPanel() {
  if (!panelTour) return;
  updateTourButton();
  refreshStatus();
}
window._refreshTourPanel = refreshTourPanel;

// Réinitialise la progression du tour courant (après confirmation).
function resetTour() {
  if (!panelTour) return;
  if (!confirm(t('resetConfirm'))) return;

  if (typeof cancelTracking === 'function') cancelTracking(true);
  delete progressCache.tours[panelTour.id];
  window.tours.progressReset(panelTour.id);
  completed = new Set();
  legStats = {};
  currentIndex = 0;
  selectedIndex = 0;
  tourStarted = false;

  renderTable();
  updateTourButton();
  if (typeof resetLegButton === 'function') resetLegButton();
  setStatus('');
  highlightSelected();
}

function initTourPanel() {
  document.getElementById('btnStartTour').addEventListener('click', () => {
    if (!panelTour) return;
    if (isTourComplete()) {
      setStatus(t('tourComplete'));
      return;
    }
    tourStarted = true;
    updateTourButton(); // grise « Commencer / Continuer le tour »
    if (typeof syncLegButton === 'function') syncLegButton(); // active « Commencer l'étape »
    selectedIndex = currentIndex;
    highlightSelected();
  });

  document.getElementById('btnResetTour').addEventListener('click', resetTour);
}
