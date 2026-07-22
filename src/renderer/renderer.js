/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// renderer.js — orchestrateur du renderer.
// Initialise la carte et les fonctionnalités, puis télécharge les tours via
// window.tours (preload). Les scripts de fonctionnalités sont chargés AVANT
// ce fichier (voir l'ordre des <script> dans index.html) ; ce fichier ne fait
// que câbler.
//
// Les tours viennent du serveur : si le téléchargement échoue, l'interface
// reste en place avec un bandeau « Réessayer » plutôt qu'une fenêtre vide.
// ============================================================

// Données { tours, airports, badgesUrl } — globale partagée avec les features.
let toursData = { tours: [], airports: {} };

// --- Bandeau d'alerte --------------------------------------------------------

// Affiche un message traduit ; onAction (facultatif) ajoute un bouton, dont
// le libellé est « Réessayer » sauf indication contraire (par exemple
// « Saisir la clé » quand c'est la clé API qui manque).
function showWarning(key, onAction, actionKey) {
  const bar = document.getElementById('dataWarning');
  const text = document.getElementById('warningText');
  const retry = document.getElementById('warningRetry');
  const label = actionKey || 'retry';

  text.dataset.i18n = key; // re-traduit à la bascule de langue
  text.textContent = t(key);
  retry.dataset.i18n = label;
  retry.textContent = t(label);
  retry.hidden = !onAction;
  retry.onclick = onAction || null;
  bar.hidden = false;
  map.invalidateSize(); // la carte a perdu la hauteur du bandeau
}

function hideWarning() {
  document.getElementById('dataWarning').hidden = true;
  map.invalidateSize();
}

// --- Chargement des tours ----------------------------------------------------

// Télécharge les tours. Trois échecs possibles, trois conduites différentes :
// pas de clé / clé refusée → la modale s'ouvre (rien d'autre à faire) ;
// serveur muet ou signature invalide → bandeau « Réessayer ».
async function loadTours() {
  const info = document.getElementById('tourInfo');
  info.textContent = t('loading');
  const data = await window.tours.getData();
  info.textContent = '';

  if (!data || data.error) {
    const code = data && data.code;
    if (code === 'nokey' || code === 'unauthorized') {
      showWarning(code === 'nokey' ? 'keyRequired' : 'keyRejected', openApiKey, 'enterKey');
      openApiKey();
    } else {
      showWarning('toursUnavailable', loadTours);
    }
    return false;
  }

  toursData = data;
  hideWarning();
  if (typeof window._refreshTourSelect === 'function') window._refreshTourSelect();
  return true;
}
window._reloadTours = loadTours;

async function boot() {
  applyTranslations();
  initMap();

  // Progression signée : instantané en mémoire + alerte si le fichier de
  // sauvegarde a été rejeté (signature invalide).
  const progress = await initProgress();

  initTourPanel();
  initSimTracking();
  initTourSelect();
  initAwards();
  initApiKey();
  initAbout();
  initLangToggle();
  document.getElementById('warningClose').addEventListener('click', hideWarning);

  const ok = await loadTours();

  // Progression illisible ou rejetée : on le signale, sinon l'utilisateur voit
  // des statistiques à zéro sans la moindre explication.
  if (ok && progress.tampered) showWarning('progressTampered');
  else if (ok && progress.erreur) showWarning('progressUnreadable');
}

// Une exception ici laisserait une fenêtre inerte sans le moindre message :
// on la journalise et on prévient à l'écran.
window.addEventListener('DOMContentLoaded', () => {
  boot().catch((e) => {
    console.error('Démarrage interrompu :', e && (e.stack || e.message || e));
  });
});
