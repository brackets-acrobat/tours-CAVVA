/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// tour-select.js — menu déroulant des tours + bouton « Voir ce tour ».
// Remplit la liste (intitulés, colonne 2), trace le tour au clic du
// bouton (et à la sélection, par confort). Utilise `toursData`
// (renderer.js), tourLabel()/t() (i18n.js) et drawTour() (route.js).
// ============================================================

// Remplit le menu déroulant dans la langue courante (préserve la sélection).
function populateTourSelect() {
  const select = document.getElementById('tourSelect');
  const current = select.value;
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('selectPlaceholder');
  select.appendChild(placeholder);

  toursData.tours.forEach((tour, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = tourLabel(tour);
    select.appendChild(opt);
  });

  select.value = current;
}
window._refreshTourSelect = populateTourSelect;

// Tour actuellement sélectionné dans le menu (ou null).
function selectedTour() {
  const idx = document.getElementById('tourSelect').value;
  if (idx === '') return null;
  return toursData.tours[Number(idx)];
}

function initTourSelect() {
  const select = document.getElementById('tourSelect');
  const viewBtn = document.getElementById('viewBtn');

  populateTourSelect();

  // « Sélectionner ce tour » : ouvre le panneau des étapes (vue scindée).
  viewBtn.addEventListener('click', () => {
    const tour = selectedTour();
    if (tour) openTourPanel(tour);
  });

  // Changement dans le menu : si le panneau est ouvert, on le bascule sur le
  // nouveau tour ; sinon simple aperçu du tracé sur la carte.
  select.addEventListener('change', () => {
    const tour = selectedTour();
    if (!tour) return;
    const panelOpen = !document.getElementById('tourPanel').hidden;
    if (panelOpen) openTourPanel(tour);
    else drawTour(tour);
  });
}
