/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// sim-tracking.js — suivi d'une étape via SimConnect.
//
// Machine à états du bouton « Commencer / Finaliser l'étape » :
//   idle     → clic : connexion MSFS, vérification de la position de départ
//   awaiting → position vérifiée (≤ 2,5 NM du départ, au sol) : passage « en
//              route », tracé du trajet parcouru + marqueur avion
//   enroute  → clic « Finaliser » : validation d'arrivée (≤ 2,5 NM de l'arrivée,
//              moteur coupé, frein de parking serré) → étape grisée, étape
//              suivante ; sinon message expliquant ce qui manque.
//
// Rayon de validation : 2,5 NM (choix utilisateur). S'appuie sur les fonctions
// globales de tour-panel.js (getPanelTour, getCurrentLegIndex, setLegActive,
// markLegCompleted, highlightSelected, haversineNm, setStatus/setStatusKey).
// ============================================================

const DEPARTURE_NM = 2.5; // rayon de vérification du départ
const ARRIVAL_NM = 2.5; // rayon de validation de l'arrivée

let phase = 'idle'; // 'idle' | 'awaiting' | 'enroute'
let trackingIndex = -1; // index de l'étape suivie
let lastFrame = null; // dernière trame SimConnect reçue
let unsubScan = null; // désabonnement du flux 'sc-scan'
let trackLayer = null; // couche du tracé live + avion
let trackLine = null; // polyligne du trajet parcouru
let planeMarker = null; // marqueur de l'avion
let legStartMs = 0; // horodatage du passage « en route »
let flownNm = 0; // distance réellement parcourue (somme des segments)
let lastPoint = null; // dernière position prise en compte dans flownNm

function airportOf(code) {
  return toursData.airports[code];
}

// --- Bouton d'étape ----------------------------------------------------------

function legButton() {
  return document.getElementById('btnLeg');
}

// Le bouton d'étape reste grisé tant que le tour n'a pas été lancé.
function syncLegButton() {
  legButton().disabled = typeof isTourStarted === 'function' ? !isTourStarted() : false;
}

function setLegButton(key) {
  const b = legButton();
  b.dataset.i18n = key;
  b.textContent = t(key);
  b.classList.toggle('enroute', key === 'finishLeg');
  syncLegButton();
}

function resetLegButton() {
  setLegButton('startLeg');
}
window._refreshLegButton = () => setLegButton(legButton().dataset.i18n || 'startLeg');

// --- Couche de tracé ---------------------------------------------------------

function ensureTrackLayer() {
  if (!trackLayer) trackLayer = L.layerGroup().addTo(map);
}

function clearTrack() {
  if (trackLayer) trackLayer.clearLayers();
  trackLine = null;
  planeMarker = null;
}

// Icône avion : SVG pointant au nord (0°), tourné du cap vrai (sens horaire).
function planeIcon(headingDeg) {
  const hdg = Number.isFinite(headingDeg) ? headingDeg : 0;
  const svg =
    '<svg viewBox="0 0 24 24" width="26" height="26">' +
    '<path fill="#1d4ed8" stroke="#fff" stroke-width="0.9" stroke-linejoin="round" ' +
    'd="M12 2 L13.6 9.6 L22 14 L22 15.8 L13.6 12.8 L13.6 18.6 L16.2 20.6 L16.2 21.8 ' +
    'L12 20.4 L7.8 21.8 L7.8 20.6 L10.4 18.6 L10.4 12.8 L2 15.8 L2 14 L10.4 9.6 Z"/></svg>';
  return L.divIcon({
    className: '',
    html: `<div class="plane-marker" style="transform:rotate(${hdg}deg)">${svg}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function updatePlane(frame) {
  const ll = [frame.lat, frame.lon];
  const icon = planeIcon(frame.heading);
  if (!planeMarker) {
    planeMarker = L.marker(ll, { icon, interactive: false, keyboard: false }).addTo(trackLayer);
  } else {
    planeMarker.setLatLng(ll);
    planeMarker.setIcon(icon);
  }
}

// --- Machine à états ---------------------------------------------------------

function stopSim() {
  if (unsubScan) {
    unsubScan();
    unsubScan = null;
  }
  try {
    window.tours.simDisconnect();
  } catch (_) {}
}

// Annule le suivi en cours et remet le bouton à « Commencer l'étape ».
function cancelTracking(silent) {
  stopSim();
  clearTrack();
  phase = 'idle';
  trackingIndex = -1;
  lastFrame = null;
  legStartMs = 0;
  flownNm = 0;
  lastPoint = null;
  resetLegButton();
  if (!silent) setStatus('');
  highlightSelected();
}
window._cancelTracking = cancelTracking;

async function startLeg() {
  const tour = getPanelTour();
  if (!tour) return;
  const idx = getCurrentLegIndex();
  if (idx >= tour.legs.length) {
    setStatus(t('tourComplete'));
    return;
  }

  trackingIndex = idx;
  phase = 'awaiting';
  setStatusKey('simConnecting');
  legButton().disabled = true;

  const res = await window.tours.simConnect();
  syncLegButton();

  if (!res || !res.ok) {
    phase = 'idle';
    trackingIndex = -1;
    setStatus(t('simFailed'));
    return;
  }

  setLegButton('cancelLeg');
  setStatusKey('awaitingDeparture', { icao: tour.legs[idx].from });
  ensureTrackLayer();
  unsubScan = window.tours.onSimScan(onScan);
}

function onScan(frame) {
  lastFrame = frame;
  const tour = getPanelTour();
  if (!tour || trackingIndex < 0) return;
  const leg = tour.legs[trackingIndex];

  updatePlane(frame);

  if (phase === 'awaiting') {
    const dep = airportOf(leg.from);
    if (!dep) return;
    const d = haversineNm(frame.lat, frame.lon, dep.lat, dep.lon);
    if (d <= DEPARTURE_NM && frame.onGround) {
      // Départ vérifié → en route.
      phase = 'enroute';
      legStartMs = Date.now();
      flownNm = 0;
      lastPoint = [frame.lat, frame.lon];
      setLegButton('finishLeg');
      setLegActive(trackingIndex);
      setStatusKey('legEnroute', { n: trackingIndex + 1 });
      trackLine = L.polyline([[frame.lat, frame.lon]], {
        color: '#1d4ed8',
        weight: 3,
        opacity: 0.9,
      }).addTo(trackLayer);
    }
  } else if (phase === 'enroute') {
    if (trackLine) trackLine.addLatLng([frame.lat, frame.lon]);
    if (lastPoint) flownNm += haversineNm(lastPoint[0], lastPoint[1], frame.lat, frame.lon);
    lastPoint = [frame.lat, frame.lon];
  }
}

function finishLeg() {
  const tour = getPanelTour();
  if (!tour || trackingIndex < 0 || !lastFrame) return;
  const leg = tour.legs[trackingIndex];
  const arr = airportOf(leg.to);

  // Critères : ≤ 2,5 NM de l'arrivée, moteur coupé, frein de parking serré.
  const reasons = [];
  const d = arr ? haversineNm(lastFrame.lat, lastFrame.lon, arr.lat, arr.lon) : Infinity;
  if (d > ARRIVAL_NM) reasons.push(tp('reasonDistance', { d: d.toFixed(1), icao: leg.to }));
  if (lastFrame.engineOn) reasons.push(t('reasonEngine'));
  if (!lastFrame.parkingBrake) reasons.push(t('reasonBrake'));

  if (reasons.length) {
    setStatus(tp('notAtArrival', { reasons: reasons.join(', ') }));
    return;
  }

  // Étape validée : on enregistre le temps et la distance réellement volés.
  const n = trackingIndex + 1;
  markLegCompleted(trackingIndex, {
    sec: legStartMs ? (Date.now() - legStartMs) / 1000 : 0,
    nm: flownNm,
  });
  cancelTracking(true);
  if (isTourComplete()) setStatus(t('tourComplete'));
  else setStatusKey('legValidated', { n });
}

function onLegButton() {
  if (phase === 'idle') startLeg();
  else if (phase === 'awaiting') cancelTracking(false);
  else if (phase === 'enroute') finishLeg();
}

function initSimTracking() {
  resetLegButton();
  legButton().addEventListener('click', onLegButton);

  // Perte de connexion inattendue pendant un suivi (MSFS fermé, etc.).
  window.tours.onSimStatus((s) => {
    if (s && s.state === 'disconnected' && phase !== 'idle') {
      stopSim();
      clearTrack();
      phase = 'idle';
      trackingIndex = -1;
      resetLegButton();
      setStatus(t('simFailed'));
      highlightSelected();
    }
  });
}
