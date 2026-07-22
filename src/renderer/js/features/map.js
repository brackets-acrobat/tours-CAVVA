/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// map.js — initialisation de la carte Leaflet.
// Fonds OpenStreetMap (défaut) et OpenTopoMap (sélecteur de calques).
// Pose la variable globale `map` et le calque `routeLayer` (le tracé du
// tour courant y est ajouté / vidé par route.js).
// ============================================================

let map;
let routeLayer; // LayerGroup : tracé + points + flèches + numéros du tour courant

function initMap() {
  map = L.map('map', { center: [46.6, 2.4], zoom: 5 });

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  });
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '© OpenStreetMap contributors, SRTM | © OpenTopoMap (CC-BY-SA)',
  });

  osm.addTo(map);
  L.control.layers({ OpenStreetMap: osm, OpenTopoMap: topo }, {}).addTo(map);

  routeLayer = L.layerGroup().addTo(map);
}
