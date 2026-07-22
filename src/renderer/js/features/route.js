/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// route.js — tracé d'un tour sur la carte.
// Dessine chaque étape (ligne rouge 3 px), pose un point rouge Ø 10 px
// sur chaque aéroport (infobulle ICAO + nom), délègue le sens et la
// numérotation à leg-arrows.js, puis recentre la carte sur le tour entier.
// Renseigne aussi le bandeau d'information (updateInfo).
// Utilise `map`, `routeLayer` (map.js) et `toursData` (renderer.js).
// ============================================================

// Tour actuellement affiché (pour re-rendu du bandeau à la bascule de langue).
let currentTour = null;

function drawTour(tour) {
  currentTour = tour;
  routeLayer.clearLayers();

  const latlngs = [];
  const seenDots = new Set();

  tour.legs.forEach((leg, i) => {
    const a = toursData.airports[leg.from];
    const b = toursData.airports[leg.to];
    if (!a || !b) return;
    const A = [a.lat, a.lon];
    const B = [b.lat, b.lon];

    // Tracé de l'étape.
    L.polyline([A, B], { color: '#e11900', weight: 3, opacity: 0.9 }).addTo(routeLayer);

    // Sens + numéro séquentiel (leg-arrows.js).
    addLegDecor(A, B, i + 1);

    addDot(leg.from, a, seenDots);
    if (i === 0) latlngs.push(A);
    latlngs.push(B);
  });

  // Point d'arrivée final (fin de la dernière étape).
  const last = tour.legs[tour.legs.length - 1];
  if (last) {
    const b = toursData.airports[last.to];
    if (b) addDot(last.to, b, seenDots);
  }

  if (latlngs.length) {
    map.fitBounds(L.latLngBounds(latlngs), { padding: [45, 45] });
  }

  updateInfo(tour);
}

// Point rouge Ø 10 px sur un aéroport (une seule fois par code).
function addDot(code, ap, seen) {
  if (seen.has(code)) return;
  seen.add(code);
  const marker = L.circleMarker([ap.lat, ap.lon], {
    radius: 5, // 10 px de diamètre
    color: '#e11900',
    weight: 1,
    fillColor: '#e11900',
    fillOpacity: 1,
  });
  marker.bindTooltip(`<span class="waypoint-label">${code}</span> — ${ap.name}`, {
    direction: 'top',
  });
  marker.addTo(routeLayer);
}

// Bandeau d'information : nombre d'étapes, régime, départ → arrivée.
function updateInfo(tour) {
  const info = document.getElementById('tourInfo');
  if (!tour) {
    info.textContent = '';
    return;
  }
  const first = tour.legs[0];
  const last = tour.legs[tour.legs.length - 1];
  const fromAp = toursData.airports[first.from];
  const toAp = toursData.airports[last.to];
  const regimes = Array.from(new Set(tour.legs.map((l) => l.regime).filter(Boolean))).join('/');
  info.textContent =
    `${tour.legs.length} ${t('legs')}` +
    (regimes ? ` · ${regimes}` : '') +
    ` · ${t('from')}: ${first.from}${fromAp ? ' (' + fromAp.name + ')' : ''}` +
    ` → ${t('to')}: ${last.to}${toAp ? ' (' + toAp.name + ')' : ''}`;
}

// Rafraîchit le bandeau dans la langue courante (appelé par lang-toggle.js).
function refreshTourInfo() {
  if (currentTour) updateInfo(currentTour);
}
window._refreshTourInfo = refreshTourInfo;
