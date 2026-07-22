/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// verifier-traductions.js — contrôle de parité FR / EN.
//
//   npm run verifier-traductions
//
// Trois questions, celles auxquelles on répond mal de tête :
//   • les deux dictionnaires portent-ils exactement les mêmes clés ?
//   • une traduction est-elle vide ?
//   • toute clé posée dans index.html (data-i18n, -title, -placeholder)
//     existe-t-elle dans les deux langues ?
//
// La panne visée : une chaîne ajoutée en français, oubliée en anglais.
// L'interface affiche alors le nom de la clé — « aboutTagline » — à un membre
// anglophone, et rien ne le signale avant lui.
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RACINE = path.resolve(__dirname, '..');
const I18N = path.join(RACINE, 'src', 'renderer', 'i18n.js');
const HTML = path.join(RACINE, 'src', 'renderer', 'index.html');

// i18n.js est écrit pour le navigateur : on l'évalue dans un contexte minimal,
// et on récupère TRANSLATIONS par la valeur de complétion (un `const` de script
// ne devient pas une propriété du contexte).
const contexte = { localStorage: { getItem: () => 'fr', setItem: () => {} } };
vm.createContext(contexte);
const { TRANSLATIONS } = vm.runInContext(
  fs.readFileSync(I18N, 'utf8') + '\n;({ TRANSLATIONS });',
  contexte
);

const problemes = [];

// --- 1. Mêmes clés de part et d'autre ---------------------------------------
const fr = Object.keys(TRANSLATIONS.fr);
const en = Object.keys(TRANSLATIONS.en);

fr.filter((k) => !en.includes(k)).forEach((k) => problemes.push(`${k} : absente de l'anglais`));
en.filter((k) => !fr.includes(k)).forEach((k) => problemes.push(`${k} : absente du français`));

// --- 2. Aucune traduction vide ----------------------------------------------
for (const [langue, dico] of Object.entries(TRANSLATIONS)) {
  for (const [cle, valeur] of Object.entries(dico)) {
    if (typeof valeur !== 'string' || valeur.trim() === '') {
      problemes.push(`${cle} : valeur vide en ${langue}`);
    }
  }
}

// --- 3. Les clés réclamées par le HTML existent ------------------------------
const html = fs.readFileSync(HTML, 'utf8');
const reclamees = [
  ...new Set(
    [...html.matchAll(/data-i18n(?:-title|-placeholder)?="([^"]+)"/g)].map((m) => m[1])
  ),
];

reclamees.forEach((cle) => {
  const manquantes = ['fr', 'en'].filter((l) => !(cle in TRANSLATIONS[l]));
  if (manquantes.length) {
    problemes.push(`${cle} : posée dans index.html, absente en ${manquantes.join(' et ')}`);
  }
});

// --- Verdict -----------------------------------------------------------------
if (problemes.length) {
  console.error(`${problemes.length} problème(s) de traduction :`);
  problemes.forEach((p) => console.error('  ' + p));
  process.exit(1);
}

console.log(
  `${fr.length} clés en français et en anglais, ` +
    `dont ${reclamees.length} réclamées par index.html. Aucun écart.`
);
