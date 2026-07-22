/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// about.js — modale « À propos » : nom, licence, code source, copyright.
//
// L'adresse du dépôt n'est pas un lien HTML : le renderer n'a pas le droit de
// naviguer. Le clic passe par le process principal, qui ouvre le navigateur du
// système sur une adresse qu'il détient lui-même (cf. main.js, 'source-open').
// ============================================================

// Version de l'application, lue une fois auprès du process principal (elle
// vient de package.json). Vide tant que la réponse n'est pas arrivée : la ligne
// reste alors absente plutôt que d'afficher « Version undefined ».
let appVersion = '';

function aboutModal() {
  return document.getElementById('aboutModal');
}

// Affiche « Version x.y.z » dans la langue courante (rappelée à la bascule).
function refreshAboutVersion() {
  const el = document.getElementById('aboutVersion');
  el.textContent = appVersion ? tp('aboutVersion', { v: appVersion }) : '';
  el.hidden = !appVersion;
}
window._refreshAbout = refreshAboutVersion;

function openAbout() {
  aboutModal().hidden = false;
}

function closeAbout() {
  aboutModal().hidden = true;
}

function initAbout() {
  document.getElementById('aboutBtn').addEventListener('click', openAbout);
  document.getElementById('aboutClose').addEventListener('click', closeAbout);
  document.getElementById('aboutBackdrop').addEventListener('click', closeAbout);
  document.getElementById('aboutSourceLink').addEventListener('click', () => window.tours.openSource());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !aboutModal().hidden) closeAbout();
  });

  // Une version indisponible ne doit pas empêcher la modale de s'ouvrir.
  window.tours
    .appVersion()
    .then((v) => {
      appVersion = typeof v === 'string' ? v : '';
      refreshAboutVersion();
    })
    .catch((e) => console.error('Version indisponible :', e && (e.message || e)));

  refreshAboutVersion();
}
