/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// test-hydravion.js — valide les 5 premières étapes du tour « Hydravion
// Canada-USA » pour se placer directement sur HY006 (5Z1 → ZHY01), la
// première étape qui arrive sur un point de coordonnées (ZHY). Sert à
// éprouver le critère d'arrivée sur l'eau — frein de parking et moteur — sans
// voler les cinq premières.
//
//   npm run test-hydravion              → valide les étapes 1 à 5
//   npm run test-hydravion -- --effacer → efface la progression de ce tour
//
// Le reste de la progression n'est pas touché : setTour n'écrit que ce tour,
// après avoir relu le fichier signé. La progression existante est tout de même
// sauvegardée en progress.json.avant-test par prudence.
// ============================================================

const fs = require('fs');
const path = require('path');

const { parseTours } = require('../src/main/tours-data');
const { parseAirports } = require('../src/main/airports-data');
const store = require('../src/main/progress-store');

const ROOT = path.resolve(__dirname, '..');
// Même emplacement que app.getPath('userData') pour ce nom d'application.
const USER_DATA = path.join(process.env.APPDATA || '', 'tours-cavva');
const FICHIER = path.join(USER_DATA, 'progress.json');

const TOUR_ID = 'Hydravion Canada-USA';
const NB_ETAPES = 5; // valide les indices 0..4 → étape courante = indice 5 (HY006)

function vitesseKt(regime) {
  if (regime === 'IFR') return 420;
  if (regime === 'Y' || regime === 'Z') return 240;
  return 115; // VFR
}

function haversineNm(a, b) {
  const R = 3440.065;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function sauvegarder() {
  if (!fs.existsSync(FICHIER)) return;
  const backup = FICHIER + '.avant-test';
  fs.copyFileSync(FICHIER, backup);
  console.log('Progression existante sauvegardée →', backup);
}

(async () => {
  if (!process.env.APPDATA) {
    console.error('APPDATA introuvable : ce script est prévu pour Windows.');
    process.exit(1);
  }
  fs.mkdirSync(USER_DATA, { recursive: true });
  store.init(USER_DATA);

  if (process.argv.includes('--effacer')) {
    sauvegarder();
    if (!store.resetTour(TOUR_ID)) {
      console.error('Effacement refusé (fichier de progression illisible ?).');
      process.exit(1);
    }
    console.log(`Progression du tour « ${TOUR_ID} » effacée.`);
    console.log('Relance : npm start');
    return;
  }

  const { tours, neededCodes } = parseTours(path.join(ROOT, 'tours01.csv'));
  const tour = tours.find((t) => t.id === TOUR_ID);
  if (!tour) {
    console.error(`Tour introuvable : « ${TOUR_ID} ». tours01.csv est-il à jour ?`);
    process.exit(1);
  }
  if (tour.legs.length <= NB_ETAPES) {
    console.error(`Le tour ne compte que ${tour.legs.length} étape(s) : rien à placer.`);
    process.exit(1);
  }

  const airports = await parseAirports(path.join(ROOT, 'airports-msfs.jsonl'), neededCodes);

  sauvegarder();

  const completed = [];
  const stats = {};
  for (let i = 0; i < NB_ETAPES; i++) {
    const leg = tour.legs[i];
    const a = airports[leg.from];
    const b = airports[leg.to];
    // Étape sans coordonnées : on la valide quand même (le but est d'avancer),
    // mais sans statistique inventée.
    completed.push(i);
    if (a && b) {
      const nm = haversineNm(a, b) * (1.04 + Math.random() * 0.06);
      const sec = (nm / vitesseKt(leg.regime)) * 3600 + 720 + Math.random() * 300;
      stats[i] = { sec: Math.round(sec), nm: Math.round(nm * 10) / 10 };
    }
  }

  if (!store.setTour(TOUR_ID, { completed, stats })) {
    console.error('Écriture refusée (fichier de progression illisible ?).');
    process.exit(1);
  }

  // Relecture indépendante : on vérifie ce qui est RÉELLEMENT sur le disque.
  const relu = JSON.parse(JSON.parse(fs.readFileSync(FICHIER, 'utf8')).payload);
  const t = relu.tours[TOUR_ID];
  const ok = t && Array.isArray(t.completed) && t.completed.length === NB_ETAPES;

  const courante = tour.legs[NB_ETAPES]; // HY006
  console.log(`\n${NB_ETAPES} étapes validées sur ${tour.legs.length} pour « ${TOUR_ID} ».`);
  console.log(
    `Étape courante : n°${NB_ETAPES + 1} — ${courante.code} ${courante.from} → ${courante.to}` +
      ` (${courante.regime || '—'})`
  );
  console.log(`Écrit et signé → ${FICHIER}`);
  console.log(`Relu depuis le disque : ${t ? t.completed.length : 0} étape(s) validée(s).`);

  if (!ok) {
    console.error('ATTENTION : la relecture ne retrouve pas les 5 étapes attendues.');
    process.exitCode = 1;
  } else {
    console.log('\nRelance maintenant : npm start — sélectionne le tour hydravion,');
    console.log('« Continuer le tour », puis teste l\'arrivée sur ZHY01 (frein de parking).');
    console.log('Pour tout remettre à zéro : npm run test-hydravion -- --effacer');
  }
})();
