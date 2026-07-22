/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// demo-progress.js — remplit <userData>/progress.json avec une progression
// de démonstration : 9 tours terminés + 1 en cours, avec des temps de vol et
// des distances plausibles. Sert à voir l'application « habitée » sans avoir
// à voler les étapes.
//
//   npm run demo-progress     → écrit la progression
//   npm run demo-progress -- --effacer   → supprime le fichier
//
// La progression existante est sauvegardée en progress.json.avant-demo.
// ============================================================

const fs = require('fs');
const path = require('path');

const { parseTours } = require('../src/main/tours-data');
const { parseAirports } = require('../src/main/airports-data');
const store = require('../src/main/progress-store');

const ROOT = path.resolve(__dirname, '..');
// Même emplacement que app.getPath('userData') pour ce nom d'application.
const USER_DATA = path.join(process.env.APPDATA, 'tours-cavva');
const FICHIER = path.join(USER_DATA, 'progress.json');

const TERMINES = [
  'France',
  'Suisse',
  'Corse',
  'Provence',
  'Italie',
  'Royaume-Uni',
  'Grece',
  'Nationale 7 en ULM',
  'France IFR',
];
const EN_COURS = { id: 'Nouvelle-Zelande', etapes: 7 };

// Vitesse de croisière retenue selon le tour et le régime de l'étape.
function vitesseKt(tour, regime) {
  if (/ULM/i.test(tour.id)) return 75;
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
  const backup = FICHIER + '.avant-demo';
  fs.copyFileSync(FICHIER, backup);
  console.log('Progression existante sauvegardée →', backup);
}

(async () => {
  if (!process.env.APPDATA) {
    console.error('APPDATA introuvable : ce script est prévu pour Windows.');
    process.exit(1);
  }
  fs.mkdirSync(USER_DATA, { recursive: true });

  if (process.argv.includes('--effacer')) {
    sauvegarder();
    fs.rmSync(FICHIER, { force: true });
    console.log('Progression supprimée →', FICHIER);
    return;
  }

  const { tours, neededCodes } = parseTours(path.join(ROOT, 'tours01.csv'));
  const airports = await parseAirports(path.join(ROOT, 'airports-msfs.jsonl'), neededCodes);

  sauvegarder();
  fs.rmSync(FICHIER, { force: true }); // on repart d'une progression vierge
  store.init(USER_DATA);

  let totalSec = 0;
  let totalNm = 0;
  let totalLegs = 0;

  function faireTour(tourId, nbEtapes) {
    const tour = tours.find((t) => t.id === tourId);
    if (!tour) throw new Error('tour introuvable : ' + tourId);
    const n = nbEtapes == null ? tour.legs.length : nbEtapes;
    const completed = [];
    const stats = {};

    for (let i = 0; i < n; i++) {
      const leg = tour.legs[i];
      const a = airports[leg.from];
      const b = airports[leg.to];
      if (!a || !b) continue;
      // Trajet réel un peu plus long que l'orthodromie (circuit, déroutements),
      // et une douzaine de minutes de roulage, montée et approche par étape.
      const nm = haversineNm(a, b) * (1.04 + Math.random() * 0.06);
      const sec = (nm / vitesseKt(tour, leg.regime)) * 3600 + 720 + Math.random() * 300;
      completed.push(i);
      stats[i] = { sec: Math.round(sec), nm: Math.round(nm * 10) / 10 };
      totalSec += Math.round(sec);
      totalNm += Math.round(nm * 10) / 10;
      totalLegs++;
    }

    if (!store.setTour(tourId, { completed, stats })) {
      throw new Error('écriture refusée pour ' + tourId + ' (fichier illisible ?)');
    }
    const h = completed.reduce((s, i) => s + stats[i].sec, 0) / 3600;
    const d = completed.reduce((s, i) => s + stats[i].nm, 0);
    console.log(
      `  ${tourId.padEnd(22)} ${String(completed.length).padStart(2)}/${String(tour.legs.length).padEnd(2)} étapes` +
        ` — ${h.toFixed(1).padStart(5)} h, ${Math.round(d).toString().padStart(5)} nm` +
        (nbEtapes == null ? '  terminé' : '  en cours')
    );
  }

  console.log('\nTours attribués :');
  TERMINES.forEach((id) => faireTour(id));
  faireTour(EN_COURS.id, EN_COURS.etapes);

  // Relecture indépendante : on vérifie ce qui est RÉELLEMENT sur le disque.
  const relu = JSON.parse(JSON.parse(fs.readFileSync(FICHIER, 'utf8')).payload);
  const nbTours = Object.keys(relu.tours).length;
  const totalMin = Math.round(totalSec / 60);

  console.log(
    `\nTotal : ${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, '0')} · ` +
      `${Math.round(totalNm).toLocaleString('fr-FR')} nm · ${totalLegs} étapes · 9 tours terminés sur ${tours.length}`
  );
  console.log(`Écrit et signé → ${FICHIER}`);
  console.log(`Relu depuis le disque : ${nbTours} tour(s), ${fs.statSync(FICHIER).size} octets`);
  if (nbTours !== 10) {
    console.error('ATTENTION : le fichier relu ne contient pas les 10 tours attendus.');
    process.exitCode = 1;
  } else {
    console.log('\nRelance maintenant : npm start');
  }
})();
