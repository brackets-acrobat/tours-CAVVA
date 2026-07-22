/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// data-crypto.js — signatures HMAC-SHA256 de l'application.
//
// Deux usages, avec deux clés distinctes :
//   • données des tours   : tours01.csv publié sur le serveur, accompagné de
//     son fichier .sig (voir build/sign-data.js et tours-source.js) ;
//   • progression         : <userData>/progress.json (voir progress-store.js).
//
// LIMITE ASSUMÉE : l'application doit pouvoir signer et vérifier seule, les
// clés sont donc dérivées d'un secret présent dans le code. Cela empêche la
// modification d'un fichier au bloc-notes ou la substitution des tours par un
// serveur détourné ; ce n'est PAS une protection contre quelqu'un qui
// déballerait l'archive asar pour y lire ce fichier.
// ============================================================

const crypto = require('crypto');

const SECRET = 'Tours-CAVVA/2026/Cyril-MILANI/donnees-des-tours';

// Clés dérivées (scrypt) et mémorisées : sels fixes, les signatures doivent
// rester vérifiables d'une exécution à l'autre.
const keys = {};
function keyFor(usage, salt) {
  if (!keys[usage]) keys[usage] = crypto.scryptSync(SECRET + '/' + usage, salt, 32);
  return keys[usage];
}

const KEYS = {
  data: () => keyFor('donnees', 'cavva-data'),
  progress: () => keyFor('progression', 'cavva-progress'),
};

function toBuffer(data) {
  return Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
}

// Signature hexadécimale (64 caractères) d'un contenu.
//   usage : 'data' (tours) ou 'progress' (progression)
function sign(data, usage) {
  const key = (KEYS[usage] || KEYS.progress)();
  return crypto.createHmac('sha256', key).update(toBuffer(data)).digest('hex');
}

// Vérification à temps constant.
function verify(data, signature, usage) {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature.trim())) return false;
  const expected = Buffer.from(sign(data, usage), 'hex');
  const given = Buffer.from(signature.trim().toLowerCase(), 'hex');
  return given.length === expected.length && crypto.timingSafeEqual(expected, given);
}

module.exports = { sign, verify };
