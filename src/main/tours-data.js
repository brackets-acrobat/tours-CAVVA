/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// tours-data.js — lecture et regroupement du fichier des tours.
//
// tours01.csv : encodage Windows-1252 (latin1), séparateur « ; ».
// Colonnes : code ; intitulé ; ICAO départ ; ICAO arrivée ; régime de vol.
// Les étapes sont regroupées par intitulé (colonne 2) dans l'ordre
// d'apparition ; la colonne 1 n'est qu'un identifiant unique d'étape.
//
// Chaque tour reçoit aussi le nom de son badge (image de récompense servie
// par le serveur), déduit du préfixe alphabétique des codes d'étapes :
// FR001 → fr.png. La déduction est purement calculatoire : aucune image
// n'est présente localement.
// ============================================================

const fs = require('fs');

// Écarts connus entre le préfixe des codes d'étapes et le nom de l'image
// publiée. À compléter si un nouveau tour ne suit pas la règle générale.
const BADGE_OVERRIDES = { jns: 'jn' };

// Nom de l'image de badge d'un tour : « JNS001 » → « jn.png ».
function badgeName(code) {
  const prefix = String(code).replace(/\d+$/, '').toLowerCase();
  return (BADGE_OVERRIDES[prefix] || prefix) + '.png';
}

// Analyse un CSV déjà chargé (chaîne décodée en latin1) et renvoie
// { tours, neededCodes }.
//   tours       : [{ id, name, badge, legs: [{ code, from, to, regime }] }]
//   neededCodes : Set des codes ICAO référencés (pour filtrer les aéroports)
function parseToursText(raw) {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  const toursByName = new Map();
  const neededCodes = new Set();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 4) continue;

    const code = parts[0].trim();
    const name = parts[1].trim();
    const from = parts[2].trim();
    const to = parts[3].trim();
    const regime = (parts[4] || '').trim();
    if (!name) continue;

    if (!toursByName.has(name)) {
      // Le badge est celui du premier code rencontré pour ce tour.
      toursByName.set(name, { id: name, name, badge: badgeName(code), legs: [] });
    }
    toursByName.get(name).legs.push({ code, from, to, regime });
    neededCodes.add(from);
    neededCodes.add(to);
  }

  return { tours: Array.from(toursByName.values()), neededCodes };
}

// Idem depuis un fichier CSV local (outils de publication).
function parseTours(csvPath) {
  return parseToursText(fs.readFileSync(csvPath, 'latin1'));
}

module.exports = { parseTours, parseToursText, badgeName };
