/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// progress-store.js — progression et statistiques, signées.
//
// Stockage dans <userData>/progress.json :
//   { "payload": "<JSON sérialisé>", "sig": "<HMAC-SHA256 du payload>" }
// où payload = { tours: { "<id>": { completed: [i…], stats: { i: {sec,nm} } } } }
//
// La signature est calculée dans le process principal (data-crypto.js) : la
// clé n'est jamais exposée au renderer. Un fichier retouché à la main est
// rejeté au chargement (progression remise à zéro, drapeau `tampered`).
//
// LIMITE ASSUMÉE : comme pour le chiffrement des données, ceci décourage
// l'édition du fichier de sauvegarde, sans prétendre résister à quelqu'un
// qui pilote l'application elle-même.
// ============================================================

const fs = require('fs');
const path = require('path');

const { sign, verify } = require('./data-crypto');

let storePath = null; // défini par init() (dépend de app.getPath)
function init(userDataDir) {
  storePath = path.join(userDataDir, 'progress.json');
}

function emptyStore() {
  return { tours: {} };
}

// Lit et vérifie le fichier à chaque appel. Renvoie { data, tampered, erreur }.
//
// Aucune mémorisation : une lecture qui échoue une fois (fichier verrouillé
// par une autre instance, accès refusé, disque occupé) ne doit pas condamner
// toute la session à une progression vide — le prochain appel réessaiera.
// Les échecs sont journalisés : « 0 tour » sans explication est indébogable.
function read() {
  let raw;
  try {
    raw = fs.readFileSync(storePath, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error(`[progression] lecture impossible (${e.code}) : ${e.message}`);
      return { data: emptyStore(), tampered: false, erreur: e.code || 'lecture' };
    }
    return { data: emptyStore(), tampered: false }; // première exécution
  }

  try {
    const file = JSON.parse(raw);
    if (!verify(file.payload, file.sig)) {
      console.error('[progression] signature invalide — fichier ignoré');
      return { data: emptyStore(), tampered: true };
    }
    const parsed = JSON.parse(file.payload);
    if (!parsed || !parsed.tours) {
      console.error('[progression] contenu inattendu — fichier ignoré');
      return { data: emptyStore(), tampered: true };
    }
    return { data: parsed, tampered: false };
  } catch (e) {
    console.error(`[progression] fichier illisible : ${e.message}`);
    return { data: emptyStore(), tampered: true };
  }
}

function write(data) {
  const payload = JSON.stringify(data);
  const tmp = storePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ payload, sig: sign(payload) }), 'utf8');
  fs.renameSync(tmp, storePath); // remplacement atomique
}

// --- API exposée au renderer (via IPC) ---------------------------------------

// Instantané complet, relu depuis le disque à chaque appel.
function getAll() {
  const { data, tampered, erreur } = read();
  return { tours: data.tours, tampered, erreur };
}

// Enregistre la progression d'un tour : { completed: [i…], stats: {…} }.
// Si le fichier existant n'a pas pu être lu, on n'écrit rien : mieux vaut
// perdre une validation d'étape que d'écraser une progression récupérable.
function setTour(tourId, entry) {
  if (!tourId) return false;
  const { data, erreur } = read();
  if (erreur) return false;
  data.tours[tourId] = {
    completed: Array.isArray(entry && entry.completed) ? entry.completed : [],
    stats: (entry && entry.stats) || {},
  };
  write(data);
  return true;
}

function resetTour(tourId) {
  const { data, erreur } = read();
  if (erreur) return false;
  delete data.tours[tourId];
  write(data);
  return true;
}

// Reprise des progressions de l'ancien stockage (localStorage) : n'écrase
// jamais une progression déjà présente dans le fichier signé.
function importLegacy(entries) {
  const { data, tampered, erreur } = read();
  // Un fichier illisible ou rejeté ne doit pas être remplacé par une reprise
  // partielle : on ne touche à rien tant qu'on ne l'a pas lu correctement.
  if (tampered || erreur) return 0;

  let imported = 0;
  for (const [tourId, entry] of Object.entries(entries || {})) {
    if (data.tours[tourId]) continue;
    data.tours[tourId] = {
      completed: Array.isArray(entry.completed) ? entry.completed : [],
      stats: entry.stats || {},
    };
    imported++;
  }
  if (imported) write(data);
  return imported;
}

module.exports = { init, getAll, setTour, resetTour, importLegacy };
