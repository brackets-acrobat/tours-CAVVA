/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// sign-data.js — génère les signatures des données publiées.
//
//   npm run sign-data
//
// Déposer ensuite les fichiers sur le serveur, côte à côte :
//   https://cavva.sixk.me/tours-cavva/tours01.csv
//   https://cavva.sixk.me/tours-cavva/tours01.csv.sig
//   https://cavva.sixk.me/tours-cavva/points01.csv       (si présent)
//   https://cavva.sixk.me/tours-cavva/points01.csv.sig
//
// Sans signature valide, l'application refuse les tours téléchargés et
// affiche un bandeau : il n'y a ni cache ni copie embarquée. À relancer à
// chaque modification du CSV.
//
// Le contrôle de présence des badges interroge le serveur ; si le dossier des
// badges est protégé par la clé API, poser la clé dans l'environnement :
//   $env:CAVVA_API_KEY = "…"   (PowerShell)
// ============================================================

const fs = require('fs');
const path = require('path');

const { sign, verify } = require('../src/main/data-crypto');
const { parseToursText } = require('../src/main/tours-data');
const { parsePointsText } = require('../src/main/points-data');
const { parseAirports } = require('../src/main/airports-data');
const { BADGES_URL } = require('../src/main/tours-source');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'tours01.csv');
const TARGET = SOURCE + '.sig';
const POINTS = path.join(ROOT, 'points01.csv');
const AIRPORTS = path.join(ROOT, 'airports-msfs.jsonl');

// Signe un fichier et écrit son .sig à côté. Renvoie le contenu brut.
function signerFichier(chemin) {
  const buf = fs.readFileSync(chemin);
  const signature = sign(buf, 'data');
  if (!verify(buf, signature, 'data')) {
    console.error(`Échec de vérification de la signature (${path.basename(chemin)}) — annulé.`);
    process.exit(1);
  }
  fs.writeFileSync(chemin + '.sig', signature + '\n', 'utf8');
  return buf;
}

const csv = fs.readFileSync(SOURCE);

// Contrôle de bon sens avant de signer : un CSV cassé ne doit pas être publié.
const { tours, neededCodes } = parseToursText(csv.toString('latin1'));
if (!tours.length) {
  console.error('Aucun tour trouvé dans tours01.csv — signature annulée.');
  process.exit(1);
}

signerFichier(SOURCE);

console.log(`${tours.length} tours, ${tours.reduce((n, t) => n + t.legs.length, 0)} étapes.`);
console.log(`Signature écrite → ${path.relative(ROOT, TARGET)}`);

// Points de passage hors base MSFS : fichier facultatif, signé de la même
// façon dès qu'il existe.
const aDesPoints = fs.existsSync(POINTS);
let points = {};
if (aDesPoints) {
  const brut = signerFichier(POINTS);
  const lu = parsePointsText(brut.toString('latin1'));
  points = lu.points;
  if (lu.rejets.length) {
    console.warn(`\nLignes écartées de points01.csv (${lu.rejets.length}) :`);
    lu.rejets.forEach((r) => console.warn('  ' + r));
  }
  console.log(`${Object.keys(points).length} points hors base MSFS, signature écrite → points01.csv.sig`);
  console.log('À déposer sur le serveur : tours01.csv + .sig, points01.csv + .sig');
} else {
  console.log('À déposer sur le serveur : tours01.csv + tours01.csv.sig');
}

// Les badges étant servis en ligne, on vérifie qu'ils y sont tous : un tour
// terminé sans image publiée n'afficherait aucune récompense.
(async () => {
  const cle = (process.env.CAVVA_API_KEY || '').trim();
  const entetes = cle ? { Authorization: `Bearer ${cle}`, 'X-API-Key': cle } : {};
  const manquants = [];
  await Promise.all(
    tours.map(async (t) => {
      try {
        const r = await fetch(BADGES_URL + t.badge, {
          method: 'HEAD',
          headers: entetes,
          signal: AbortSignal.timeout(8000),
        });
        if (r.status === 401 || r.status === 403) {
          manquants.push(`${t.badge} (${t.id}, HTTP ${r.status} — clé API absente ou refusée)`);
        } else if (!r.ok) manquants.push(`${t.badge} (${t.id}, HTTP ${r.status})`);
      } catch (e) {
        manquants.push(`${t.badge} (${t.id}, ${e.message})`);
      }
    })
  );
  if (manquants.length) {
    console.warn(`\nBadges absents du serveur (${manquants.length}/${tours.length}) :`);
    manquants.forEach((m) => console.warn('  ' + m));
  } else {
    console.log(`Badges : ${tours.length}/${tours.length} présents sur ${BADGES_URL}`);
  }

  // Dernier contrôle : tout code d'étape doit se résoudre, soit dans la base
  // MSFS, soit dans points01.csv. Un orphelin passe la signature sans bruit et
  // ne se voit qu'en jeu — étape sans tracé, jamais validable.
  if (!fs.existsSync(AIRPORTS)) {
    console.warn(`\nairports-msfs.jsonl absent : codes d'étapes non vérifiés.`);
    return;
  }
  const aeroports = await parseAirports(AIRPORTS, neededCodes);
  const orphelins = [...neededCodes].filter((c) => !aeroports[c] && !points[c]);
  if (orphelins.length) {
    console.warn(`\nCodes sans coordonnées (${orphelins.length}/${neededCodes.size}) :`);
    console.warn('  ' + orphelins.join(', '));
    console.warn('  À ajouter à points01.csv, sinon ces étapes seront injouables.');
  } else {
    console.log(`Codes d'étapes : ${neededCodes.size}/${neededCodes.size} résolus.`);
  }
})();
