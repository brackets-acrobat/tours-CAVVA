/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// awards.js — modale « Badges et statistiques ».
//
// Agrège la progression de TOUS les tours à partir de l'instantané tenu par
// tour-panel.js (loadCompleted / loadLegStats, alimentés par le fichier signé
// du process principal) :
//   • total du temps de vol et de la distance parcourue sur les étapes validées
//   • badges des tours entièrement terminés, servis par le serveur
//
// Les étapes validées avant l'ajout des statistiques n'ont pas de temps ni de
// distance enregistrés : leur distance est alors estimée par l'orthodromie de
// l'étape, et leur temps compté pour zéro.
//
// Les images de badges sont servies par le serveur ; il n'y a aucune copie
// locale. Elles sont téléchargées par le PROCESS PRINCIPAL, qui les renvoie en
// data: URL : une balise <img src="https://…"> ne peut pas porter la clé API
// en en-tête, et la mettre dans l'adresse l'inscrirait dans les journaux du
// serveur.
// ============================================================

// Formate une durée en heures/minutes selon la langue courante.
function formatDuration(totalSec) {
  const total = Math.max(0, Math.round(totalSec / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return currentLang === 'en' ? `${h}h ${String(m).padStart(2, '0')}m` : `${h} h ${String(m).padStart(2, '0')}`;
}

// Parcourt tous les tours et agrège la progression enregistrée.
function collectAwards() {
  let sec = 0;
  let nm = 0;
  let legsDone = 0;
  const badges = [];

  for (const tour of toursData.tours) {
    const done = loadCompleted(tour.id);
    if (!done.size) continue;
    const stats = loadLegStats(tour.id);

    tour.legs.forEach((leg, i) => {
      if (!done.has(i)) return;
      legsDone++;
      const s = stats[i];
      if (s) {
        sec += s.sec || 0;
        nm += s.nm || 0;
      } else {
        const d = legDistanceNm(leg); // repli : distance théorique de l'étape
        if (d) nm += d;
      }
    });

    if (tour.legs.length && tour.legs.every((_, i) => done.has(i))) badges.push(tour);
  }

  return { sec, nm, legsDone, badges };
}

// --- Rendu -------------------------------------------------------------------

function statTile(labelKey, value) {
  const div = document.createElement('div');
  div.className = 'stat-tile';
  const v = document.createElement('div');
  v.className = 'stat-value';
  v.textContent = value;
  const l = document.createElement('div');
  l.className = 'stat-label';
  l.textContent = t(labelKey);
  div.appendChild(v);
  div.appendChild(l);
  return div;
}

// Le téléchargement des badges étant asynchrone, le message « aucun tour
// terminé » est réévalué après chaque carte retirée.
function updateAwardsEmpty() {
  const grid = document.getElementById('awardsBadges');
  document.getElementById('awardsEmpty').hidden = grid.children.length > 0;
}

function badgeCard(tour) {
  const fig = document.createElement('figure');
  fig.className = 'badge-card';
  const img = document.createElement('img');
  img.alt = tourLabel(tour);
  // Image absente du serveur (ou clé refusée) : on retire la carte plutôt que
  // d'afficher un cadre vide.
  const drop = () => {
    fig.remove();
    updateAwardsEmpty();
  };
  img.addEventListener('error', drop);
  window.tours
    .badgeImage(tour.badge)
    .then((src) => {
      if (src) img.src = src;
      else drop();
    })
    .catch(drop);
  const cap = document.createElement('figcaption');
  cap.textContent = tourLabel(tour);
  fig.appendChild(img);
  fig.appendChild(cap);
  return fig;
}

function renderAwards() {
  const { sec, nm, legsDone, badges } = collectAwards();

  const statsBox = document.getElementById('awardsStats');
  statsBox.innerHTML = '';
  statsBox.appendChild(statTile('statHours', formatDuration(sec)));
  statsBox.appendChild(statTile('statDistance', Math.round(nm).toLocaleString(currentLang === 'en' ? 'en-US' : 'fr-FR') + ' nm'));
  statsBox.appendChild(statTile('statLegs', String(legsDone)));
  statsBox.appendChild(statTile('statTours', `${badges.length} / ${toursData.tours.length}`));

  const grid = document.getElementById('awardsBadges');
  grid.innerHTML = '';
  badges.forEach((tour) => {
    if (tour.badge) grid.appendChild(badgeCard(tour));
  });
  // Message d'attente basé sur les cartes réellement rendues : un tour terminé
  // dont l'image manque sur le serveur ne laisse pas la section vide sans texte.
  updateAwardsEmpty();
}

// --- Ouverture / fermeture ---------------------------------------------------

function awardsModal() {
  return document.getElementById('awardsModal');
}

function openAwards() {
  renderAwards();
  awardsModal().hidden = false;
}

function closeAwards() {
  awardsModal().hidden = true;
}

// Re-rend la modale si elle est ouverte (changement de langue).
function refreshAwards() {
  if (!awardsModal().hidden) renderAwards();
}
window._refreshAwards = refreshAwards;

function initAwards() {
  document.getElementById('awardsBtn').addEventListener('click', openAwards);
  document.getElementById('awardsClose').addEventListener('click', closeAwards);
  document.getElementById('awardsBackdrop').addEventListener('click', closeAwards);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !awardsModal().hidden) closeAwards();
  });
}
