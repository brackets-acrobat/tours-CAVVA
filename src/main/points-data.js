/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// points-data.js — points de passage hors base MSFS.
//
// points01.csv : encodage Windows-1252 (latin1), séparateur « ; ».
// Colonnes : code ; latitude ; longitude ; nom (facultatif).
//
// Certaines étapes partent ou arrivent d'un plan d'eau qui n'est ni un
// aéroport ni une hydrobase : rien à trouver dans airports-msfs.jsonl. On leur
// donne un code hors espace ICAO (ZHY01…) et leurs coordonnées vivent ici.
// Le résultat a la même forme que celui de airports-data.js — { name, lat, lon }
// — et rejoint le même dictionnaire : carte, distances et suivi SimConnect
// n'ont pas à savoir d'où vient un point.
//
// Les coordonnées sont en degrés décimaux. La lecture est tolérante sur la
// forme, parce que le fichier vient d'un tableur : virgule ou point décimal,
// signe « ° » présent ou non, hémisphère en lettre (N/S/E/W, O accepté pour
// Ouest) ou signe négatif.
// ============================================================

const fs = require('fs');

// Un champ de coordonnée → nombre signé. `negatifs` liste les lettres
// d'hémisphère qui inversent le signe (S pour une latitude, W/O pour une
// longitude). Renvoie null si le champ n'est pas exploitable.
function parseDegres(champ, negatifs) {
  const brut = String(champ || '').trim();
  if (!brut) return null;

  const hemisphere = (brut.match(/[NSEWO]/i) || [''])[0].toUpperCase();
  const nombre = parseFloat(brut.replace(/[^0-9,.-]/g, '').replace(',', '.'));
  if (!Number.isFinite(nombre)) return null;

  // Sans lettre d'hémisphère, le signe du nombre fait foi.
  if (!hemisphere) return nombre;
  return negatifs.includes(hemisphere) ? -Math.abs(nombre) : Math.abs(nombre);
}

// Analyse un CSV déjà chargé (chaîne décodée en latin1).
// `neededCodes` (facultatif) restreint le résultat aux codes réellement
// référencés par les tours, comme le fait parseAirports.
// Renvoie { points, rejets } :
//   points : { code -> { name, lat, lon } }
//   rejets : [ 'ZHY07 : latitude illisible', … ] — lignes écartées
function parsePointsText(raw, neededCodes) {
  const lignes = String(raw || '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  const points = {};
  const rejets = [];

  for (let i = 1; i < lignes.length; i++) {
    const parts = lignes[i].split(';');
    if (parts.length < 3) continue;

    const code = parts[0].trim();
    if (!code) continue;
    if (neededCodes && !neededCodes.has(code)) continue;

    const lat = parseDegres(parts[1], 'S');
    const lon = parseDegres(parts[2], 'WO');
    if (lat === null || lon === null) {
      rejets.push(`${code} : coordonnées illisibles`);
      continue;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      rejets.push(`${code} : coordonnées hors limites (${lat}, ${lon})`);
      continue;
    }

    points[code] = { name: (parts[3] || '').trim() || code, lat, lon };
  }

  return { points, rejets };
}

// Idem depuis un fichier CSV local (outils de publication).
function parsePoints(csvPath) {
  return parsePointsText(fs.readFileSync(csvPath, 'latin1'));
}

module.exports = { parsePoints, parsePointsText };
