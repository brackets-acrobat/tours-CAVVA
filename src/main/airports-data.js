/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// airports-data.js — extraction des coordonnées d'aéroports.
//
// airports-msfs.jsonl : ~70 Mo, un objet JSON par ligne (source
// MSFS 2024 / SimConnect). Lu en streaming pour ne conserver que les
// aéroports référencés par les tours. Correspondance testée sur
// icao_code, ident, gps_code puis local_code.
// ============================================================

const fs = require('fs');
const readline = require('readline');

// Renvoie une Promise résolue avec un dictionnaire ICAO -> { name, lat, lon }
// limité aux codes présents dans neededCodes.
function parseAirports(jsonlPath, neededCodes) {
  return new Promise((resolve, reject) => {
    const airports = {};
    const rl = readline.createInterface({
      input: fs.createReadStream(jsonlPath),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line || line[0] !== '{') return;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        return;
      }
      if (o.__meta) return;
      if (typeof o.latitude_deg !== 'number' || typeof o.longitude_deg !== 'number') return;

      for (const key of [o.icao_code, o.ident, o.gps_code, o.local_code]) {
        if (key && neededCodes.has(key) && !airports[key]) {
          airports[key] = {
            name: o.name || key,
            lat: o.latitude_deg,
            lon: o.longitude_deg,
          };
        }
      }
    });

    rl.on('close', () => resolve(airports));
    rl.on('error', reject);
  });
}

module.exports = { parseAirports };
