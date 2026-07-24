/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// new-tours.js — modale « Nouveau(x) tour(s) disponible(s) ».
//
// Au démarrage, compare la liste des tours servie par le serveur à ceux déjà
// vus lors des lancements précédents (mémorisés dans localStorage, comme la
// préférence de langue). Tout tour absent de cette mémoire est une nouveauté.
//
// PREMIER LANCEMENT : rien n'est mémorisé. On enregistre alors la liste
// courante SANS rien afficher — les tours déjà présents ne sont pas des
// nouveautés, et personne ne veut voir défiler les trente au premier
// démarrage. La modale ne s'ouvre qu'aux ajouts ultérieurs.
//
// La comparaison porte sur l'identifiant du tour (son intitulé FR, colonne 2
// du CSV) ; l'affichage passe par tourLabel() pour suivre la langue courante.
// ============================================================

const KNOWN_TOURS_KEY = 'cavva:knownTours';

// Tours détectés comme nouveaux, gardés pour re-rendre la liste à la bascule
// de langue tant que la modale est ouverte.
let newTours = [];

function newToursModal() {
  return document.getElementById('newToursModal');
}

// Liste des identifiants déjà connus, ou null si rien n'a encore été mémorisé
// (premier lancement, ou stockage effacé). Un contenu illisible est traité
// comme null : au pire, on réamorce.
function readKnownTours() {
  try {
    const arr = JSON.parse(localStorage.getItem(KNOWN_TOURS_KEY));
    return Array.isArray(arr) ? arr : null;
  } catch (_) {
    return null;
  }
}

function writeKnownTours(ids) {
  try {
    localStorage.setItem(KNOWN_TOURS_KEY, JSON.stringify(ids));
  } catch (_) {
    /* stockage indisponible : au prochain démarrage, on resignalera — sans
       gravité, c'est une information, pas une donnée. */
  }
}

function renderNewToursList() {
  const ul = document.getElementById('newToursList');
  ul.innerHTML = '';
  newTours.forEach((tour) => {
    const li = document.createElement('li');
    li.textContent = tourLabel(tour);
    ul.appendChild(li);
  });
}
// Rafraîchit la liste dans la langue courante (appelé par lang-toggle.js).
window._refreshNewTours = () => {
  if (!newToursModal().hidden) renderNewToursList();
};

function closeNewTours() {
  newToursModal().hidden = true;
}

// Compare la liste serveur à la mémoire, ouvre la modale s'il y a du nouveau,
// puis met la mémoire à jour pour ne pas resignaler ces tours au prochain coup.
function notifyNewTours(tours) {
  if (!Array.isArray(tours) || !tours.length) return;
  const currentIds = tours.map((t) => t.id);
  const known = readKnownTours();

  if (known === null) {
    writeKnownTours(currentIds); // amorçage silencieux
    return;
  }

  const knownSet = new Set(known);
  newTours = tours.filter((t) => !knownSet.has(t.id));
  // Mémoire alignée sur la liste courante quoi qu'il arrive : les nouveautés
  // affichées aujourd'hui ne doivent pas reparaître demain.
  writeKnownTours(currentIds);

  if (newTours.length) {
    renderNewToursList();
    newToursModal().hidden = false;
  }
}
window.notifyNewTours = notifyNewTours;

function initNewTours() {
  document.getElementById('newToursClose').addEventListener('click', closeNewTours);
  document.getElementById('newToursBackdrop').addEventListener('click', closeNewTours);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !newToursModal().hidden) closeNewTours();
  });
}
