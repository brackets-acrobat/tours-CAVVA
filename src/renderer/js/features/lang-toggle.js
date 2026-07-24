/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// lang-toggle.js — bouton bascule FR / EN.
// Bascule la langue (i18n.js) puis rafraîchit les éléments dynamiques :
// libellé du bouton, menu déroulant des tours et bandeau d'information.
// ============================================================

// Met à jour le libellé du bouton (FR ⇄ EN) selon la langue courante.
function refreshLangToggle() {
  document.getElementById('langToggle').textContent = currentLang === 'fr' ? 'FR' : 'EN';
}
window._refreshLangToggle = refreshLangToggle;

function initLangToggle() {
  const btn = document.getElementById('langToggle');
  refreshLangToggle();

  btn.addEventListener('click', () => {
    setLanguage(currentLang === 'fr' ? 'en' : 'fr');
    refreshLangToggle();
    // Éléments dynamiques (hors data-i18n) à régénérer dans la nouvelle langue.
    if (typeof window._refreshTourSelect === 'function') window._refreshTourSelect();
    if (typeof window._refreshTourInfo === 'function') window._refreshTourInfo();
    if (typeof window._refreshTourPanel === 'function') window._refreshTourPanel();
    if (typeof window._refreshLegButton === 'function') window._refreshLegButton();
    if (typeof window._refreshAwards === 'function') window._refreshAwards();
    if (typeof window._refreshApiKey === 'function') window._refreshApiKey();
    if (typeof window._refreshAbout === 'function') window._refreshAbout();
    if (typeof window._refreshNewTours === 'function') window._refreshNewTours();
  });
}
