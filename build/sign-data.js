/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// sign-data.js — génère tours01.csv.sig à partir de tours01.csv.
//
//   npm run sign-data
//
// Déposer ensuite les DEUX fichiers sur le serveur, côte à côte :
//   https://cavva.sixk.me/tours-cavva/tours01.csv
//   https://cavva.sixk.me/tours-cavva/tours01.csv.sig
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
const { BADGES_URL } = require('../src/main/tours-source');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'tours01.csv');
const TARGET = SOURCE + '.sig';

const csv = fs.readFileSync(SOURCE);

// Contrôle de bon sens avant de signer : un CSV cassé ne doit pas être publié.
const { tours } = parseToursText(csv.toString('latin1'));
if (!tours.length) {
  console.error('Aucun tour trouvé dans tours01.csv — signature annulée.');
  process.exit(1);
}

const signature = sign(csv, 'data');
if (!verify(csv, signature, 'data')) {
  console.error('Échec de vérification de la signature — annulé.');
  process.exit(1);
}
fs.writeFileSync(TARGET, signature + '\n', 'utf8');

console.log(`${tours.length} tours, ${tours.reduce((n, t) => n + t.legs.length, 0)} étapes.`);
console.log(`Signature écrite → ${path.relative(ROOT, TARGET)}`);
console.log('À déposer sur le serveur : tours01.csv + tours01.csv.sig');

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
})();
