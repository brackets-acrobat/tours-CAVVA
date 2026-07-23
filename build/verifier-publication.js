/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// verifier-publication.js — contrôle ce que le serveur sert réellement.
//
//   $env:CAVVA_API_KEY = "…"        (PowerShell)
//   npm run verifier-publication
//
// À lancer APRÈS avoir téléversé les données. Le script emprunte le chemin de
// l'application elle-même (resolveTours / resolvePoints / fetchBadge) : ce qui
// passe ici passera en jeu, et un dépôt incomplet se voit tout de suite au lieu
// d'attendre qu'un pilote le découvre.
//
// Sont vérifiés, dans cet ordre :
//   • la clé est acceptée ;
//   • le CSV servi est identique, octet pour octet, à la copie locale signée ;
//   • sa signature publiée correspond (c'est resolveTours qui la contrôle) ;
//   • idem pour points01.csv, dont l'absence est ici une ERREUR dès lors qu'un
//     fichier local existe — côté application un 404 est muet, et c'est
//     précisément ce qu'il faut débusquer avant les membres ;
//   • tous les codes d'étapes se résolvent (base MSFS + points) ;
//   • chaque badge de tour est présent.
// ============================================================

const fs = require('fs');
const path = require('path');

const { parseToursText } = require('../src/main/tours-data');
const { parsePointsText } = require('../src/main/points-data');
const { parseAirports } = require('../src/main/airports-data');
const { resolveTours, resolvePoints, fetchBadge, TOURS_URL } = require('../src/main/tours-source');

const ROOT = path.resolve(__dirname, '..');
const TOURS = path.join(ROOT, 'tours01.csv');
const POINTS = path.join(ROOT, 'points01.csv');
const AIRPORTS = path.join(ROOT, 'airports-msfs.jsonl');

let echecs = 0;
const ok = (m) => console.log('  ok    ' + m);
const ko = (m) => {
  echecs++;
  console.error('  ÉCHEC ' + m);
};

// Le latin1 étant une correspondance exacte octet ↔ caractère, comparer les
// chaînes revient à comparer les octets — ce qui compte, la signature en
// dépendant.
function comparerAuLocal(nom, servi, chemin) {
  const local = fs.readFileSync(chemin, 'latin1');
  if (servi === local) {
    ok(`${nom} : identique à la copie locale (${local.length} octets)`);
    return true;
  }
  ko(`${nom} : DIFFÈRE de la copie locale (servi ${servi.length} o, local ${local.length} o)`);
  console.error('        La version en ligne n\'est pas celle que tu as signée : téléverse à nouveau.');
  return false;
}

(async () => {
  const cle = (process.env.CAVVA_API_KEY || '').trim();
  if (!cle) {
    console.error('CAVVA_API_KEY absente de l\'environnement — contrôle impossible.');
    console.error('  PowerShell :  $env:CAVVA_API_KEY = "<ta clé>"');
    process.exit(1);
  }

  console.log(`Serveur : ${TOURS_URL.replace(/\/tours-cavva\/.*$/, '')}\n`);

  // --- Tours ---------------------------------------------------------------
  console.log('Tours');
  let tours = [];
  let neededCodes = new Set();
  try {
    const { text } = await resolveTours(cle);
    ok('clé acceptée, signature vérifiée');
    comparerAuLocal('tours01.csv', text, TOURS);
    ({ tours, neededCodes } = parseToursText(text));
    ok(`${tours.length} tours, ${tours.reduce((n, t) => n + t.legs.length, 0)} étapes`);
  } catch (e) {
    ko(`tours indisponibles (${e.code || 'network'}) : ${e.message}`);
    process.exit(1); // sans les tours, le reste n'a rien à contrôler
  }

  // --- Points --------------------------------------------------------------
  console.log('\nPoints hors base MSFS');
  let points = {};
  const localPoints = fs.existsSync(POINTS);
  try {
    const servis = await resolvePoints(cle);
    if (!servis && localPoints) {
      ko('points01.csv absent du serveur (404) alors qu\'il existe en local.');
      console.error('        Deux causes possibles, à écarter dans cet ordre :');
      console.error('        1. le site n\'a pas été redéployé — la liste blanche de');
      console.error('           ToursCavvaController ignore encore points01.csv ;');
      console.error('        2. le fichier n\'est pas dans storage/tours-cavva/, ou pas sous ce nom.');
    } else if (!servis) {
      ok('aucun point publié, aucun fichier local — cohérent');
    } else {
      ok('signature vérifiée');
      comparerAuLocal('points01.csv', servis.text, POINTS);
      const lu = parsePointsText(servis.text);
      points = lu.points;
      lu.rejets.forEach((r) => ko('ligne illisible — ' + r));
      ok(`${Object.keys(points).length} points lus`);
    }
  } catch (e) {
    ko(`points indisponibles (${e.code || 'network'}) : ${e.message}`);
  }

  // --- Codes d'étapes ------------------------------------------------------
  console.log('\nCodes d\'étapes');
  if (!fs.existsSync(AIRPORTS)) {
    console.warn('  (airports-msfs.jsonl absent : contrôle ignoré)');
  } else {
    const aeroports = await parseAirports(AIRPORTS, neededCodes);
    const orphelins = [...neededCodes].filter((c) => !aeroports[c] && !points[c]);
    if (orphelins.length) {
      ko(`${orphelins.length}/${neededCodes.size} sans coordonnées : ${orphelins.join(', ')}`);
      console.error('        Ces étapes s\'afficheront sans tracé et ne pourront pas être validées.');
    } else {
      ok(`${neededCodes.size}/${neededCodes.size} résolus`);
    }
  }

  // --- Badges --------------------------------------------------------------
  console.log('\nBadges');
  const manquants = [];
  await Promise.all(
    tours.map(async (t) => {
      try {
        if (!(await fetchBadge(t.badge, cle))) manquants.push(`${t.badge} (${t.id})`);
      } catch (e) {
        manquants.push(`${t.badge} (${t.id}, ${e.code || e.message})`);
      }
    })
  );
  if (manquants.length) {
    ko(`${manquants.length}/${tours.length} absents :`);
    manquants.forEach((m) => console.error('        ' + m));
  } else {
    ok(`${tours.length}/${tours.length} présents`);
  }

  console.log(
    echecs === 0
      ? '\nPublication conforme : l\'application verra exactement ce qui a été signé.'
      : `\n${echecs} problème(s) — voir ci-dessus.`
  );
  process.exit(echecs === 0 ? 0 : 1);
})();
