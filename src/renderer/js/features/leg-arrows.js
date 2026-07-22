/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// leg-arrows.js — sens et numérotation des étapes.
// Pour chaque étape : une flèche rouge orientée départ → arrivée, et un
// badge numéroté séquentiel (1, 2, 3 …, indépendant du code colonne 1).
// Éléments posés sur `routeLayer` (map.js) via addLegDecor().
// ============================================================

// Point à la fraction t du segment A→B.
function lerp(A, B, t) {
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
}

// Angle écran du segment (indépendant du zoom : Mercator est conforme,
// la projection ne fait qu'appliquer une homothétie).
function segmentAngle(A, B) {
  const pa = map.project(L.latLng(A));
  const pb = map.project(L.latLng(B));
  return (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI;
}

// Ajoute la flèche de sens au milieu du segment.
function addArrow(A, B) {
  const mid = lerp(A, B, 0.55);
  const angle = segmentAngle(A, B); // le glyphe ➤ pointe vers l'est (0°) au repos
  const icon = L.divIcon({
    className: '',
    html: `<div class="leg-arrow" style="transform:rotate(${angle}deg)">➤</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
  L.marker(mid, { icon, interactive: false, keyboard: false }).addTo(routeLayer);
}

// Ajoute le badge numéroté de l'étape (au tiers du segment).
function addLegNumber(A, B, n) {
  const pos = lerp(A, B, 0.32);
  const icon = L.divIcon({
    className: '',
    html: `<div class="leg-num">${n}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  L.marker(pos, { icon, interactive: false, keyboard: false }).addTo(routeLayer);
}

// Décore une étape : flèche de sens + numéro séquentiel.
function addLegDecor(A, B, n) {
  addArrow(A, B);
  addLegNumber(A, B, n);
}
