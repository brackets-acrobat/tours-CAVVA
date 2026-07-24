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
// params (facultatif) remplit un message à trous ; il est conservé sur
// l'élément pour que la bascule de langue le retrouve.
function showWarning(key, onAction, actionKey, params) {
  const bar = document.getElementById('dataWarning');
  const text = document.getElementById('warningText');
  const retry = document.getElementById('warningRetry');
  const label = actionKey || 'retry';

  text.dataset.i18n = key; // re-traduit à la bascule de langue
  if (params) text.dataset.i18nParams = JSON.stringify(params);
  else delete text.dataset.i18nParams;
  text.textContent = params ? tp(key, params) : t(key);
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

  // Les tours sont là, mais certains codes d'étapes n'ont pas de coordonnées
  // (points01.csv absent du serveur, ou code absent du fichier). Le tour
  // concerné s'affiche amputé : sans ce bandeau, la seule trace est dans la
  // console du terminal, que personne ne voit dans l'application packagée.
  const orphelins = data.orphelins || [];
  if (orphelins.length) {
    const apercu = orphelins.slice(0, 8).join(', ') + (orphelins.length > 8 ? '…' : '');
    showWarning('missingCoords', loadTours, null, { n: orphelins.length, codes: apercu });
  } else {
    hideWarning();
  }

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
  initNewTours();
  initLangToggle();
  document.getElementById('warningClose').addEventListener('click', hideWarning);

  const ok = await loadTours();

  // Nouveaux tours depuis le dernier lancement : modale dédiée (indépendante du
  // bandeau ci-dessous). Ne s'ouvre qu'au-delà du premier démarrage.
  if (ok) notifyNewTours(toursData.tours);

  // Progression illisible ou rejetée : on le signale, sinon l'utilisateur voit
  // des statistiques à zéro sans la moindre explication.
  if (ok && progress.tampered) showWarning('progressTampered');
  else if (ok && progress.erreur) showWarning('progressUnreadable');

  // Vérification de mise à jour en dernier : purement informative, elle ne doit
  // ni retarder le démarrage (non attendue) ni recouvrir un avertissement déjà
  // affiché (une erreur prime sur une invitation à mettre à jour).
  maybeNotifyUpdate();
}

// Affiche le bandeau de mise à jour si une version plus récente est publiée et
// que rien d'autre n'occupe déjà le bandeau. Silencieuse sur échec : hors
// ligne, l'application n'a de toute façon rien à faire.
async function maybeNotifyUpdate() {
  try {
    if (!document.getElementById('dataWarning').hidden) return;
    const u = await window.tours.checkUpdate();
    if (u && u.newer && document.getElementById('dataWarning').hidden) {
      showWarning('updateAvailable', () => window.tours.openReleases(), 'updateDownload', {
        latest: u.latest,
        current: u.current,
      });
    }
  } catch (e) {
    console.error('Vérification de mise à jour impossible :', e && (e.message || e));
  }
}

// Une exception ici laisserait une fenêtre inerte sans le moindre message :
// on la journalise et on prévient à l'écran.
window.addEventListener('DOMContentLoaded', () => {
  boot().catch((e) => {
    console.error('Démarrage interrompu :', e && (e.stack || e.message || e));
  });
});
