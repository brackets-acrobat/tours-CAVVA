/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// tours-source.js — téléchargement des tours et des badges.
//
// Les tours viennent EXCLUSIVEMENT du serveur : aucune copie locale, aucun
// cache. MSFS 2024 fonctionne en streaming, donc sans connexion il n'y a de
// toute façon pas de simulateur — l'application n'a rien à faire hors ligne.
//
// Deux contrôles, qui répondent à deux questions différentes :
//   • la CLÉ API (api-key-store.js) accompagne chaque requête : le serveur
//     répond 401/403 à qui n'est pas inscrit sur cavva.sixk.me ;
//   • la SIGNATURE publiée à côté du CSV (TOURS_URL + '.sig') doit
//     correspondre : un serveur détourné (fichier hosts, proxy) ne peut pas
//     injecter d'autres tours.
//
// Les erreurs sont typées (e.code) pour que l'interface distingue « clé
// refusée » de « hors ligne » — deux situations que l'utilisateur ne corrige
// pas de la même manière.
//
// Publier une mise à jour : npm run sign-data, puis déposer sur le serveur
// tours01.csv ET tours01.csv.sig — plus points01.csv et points01.csv.sig si des
// étapes visent des coordonnées hors base MSFS.
// ============================================================

// Racine du site. CAVVA_BASE_URL permet de viser une instance locale le temps
// d'un essai (npm start avec la variable posée) : la signature du CSV reste
// vérifiée, un serveur de test ne peut donc pas injecter d'autres tours.
const BASE_URL = (process.env.CAVVA_BASE_URL || 'https://cavva.sixk.me').replace(/\/+$/, '');

const TOURS_URL = BASE_URL + '/tours-cavva/tours01.csv';
const SIG_URL = TOURS_URL + '.sig';
// Points de passage hors base MSFS (points-data.js). Facultatif : un serveur
// qui n'en publie pas répond 404, et les tours se chargent quand même.
const POINTS_URL = BASE_URL + '/tours-cavva/points01.csv';
const POINTS_SIG_URL = POINTS_URL + '.sig';
const BADGES_URL = BASE_URL + '/badges/';
const ACCOUNT_URL = BASE_URL + '/compte'; // page où la clé est générée
const TIMEOUT_MS = 10000;

const { verify } = require('./data-crypto');

// Codes d'erreur : 'nokey' | 'unauthorized' | 'network' | 'signature' | 'content'
function fail(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// La clé part dans deux en-têtes : « Authorization: Bearer » (usuel) et
// « X-API-Key » (accepté tel quel par la plupart des configurations Apache /
// nginx / PHP). Le serveur n'a qu'à lire celui qui l'arrange.
function headers(apiKey) {
  const h = { 'Cache-Control': 'no-cache' };
  if (apiKey) {
    h.Authorization = `Bearer ${apiKey}`;
    h['X-API-Key'] = apiKey;
  }
  return h;
}

// `absentAdmis` : un 404 renvoie null au lieu de lever — pour une ressource
// facultative, dont l'absence est un état légitime et non une panne.
async function download(url, apiKey, absentAdmis) {
  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
      headers: headers(apiKey),
    });
  } catch (e) {
    throw fail('network', `${url} : ${e.message}`);
  }
  if (res.status === 401 || res.status === 403) throw fail('unauthorized', `${url} : HTTP ${res.status}`);
  if (res.status === 404 && absentAdmis) return null;
  if (!res.ok) throw fail('network', `${url} : HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Un contenu vide ou tronqué ne doit pas être présenté comme des tours.
function looksValid(buf) {
  return buf && buf.length > 64 && /;/.test(buf.subarray(0, 4096).toString('latin1'));
}

// Renvoie { text } — CSV décodé en latin1, prêt pour parseToursText.
// Lève une erreur typée : pas de clé, clé refusée, serveur injoignable,
// signature invalide ou contenu inexploitable.
async function resolveTours(apiKey) {
  if (!apiKey) throw fail('nokey', 'aucune clé API enregistrée');

  const [csv, sigRaw] = await Promise.all([download(TOURS_URL, apiKey), download(SIG_URL, apiKey)]);
  const signature = sigRaw.toString('utf8').trim().split(/\s+/)[0]; // tolère « <sig>  tours01.csv »

  if (!verify(csv, signature, 'data')) throw fail('signature', 'signature invalide');
  if (!looksValid(csv)) throw fail('content', 'contenu inexploitable');

  return { text: csv.toString('latin1') };
}

// Renvoie { text } pour les points de passage, ou null si le serveur n'en
// publie pas (404). Même exigence de signature que les tours dès lors que le
// fichier existe : ces coordonnées décident où une étape est validée.
async function resolvePoints(apiKey) {
  if (!apiKey) throw fail('nokey', 'aucune clé API enregistrée');

  const [csv, sigRaw] = await Promise.all([
    download(POINTS_URL, apiKey, true),
    download(POINTS_SIG_URL, apiKey, true),
  ]);
  if (!csv) return null;
  if (!sigRaw) throw fail('signature', 'points01.csv publié sans sa signature');

  const signature = sigRaw.toString('utf8').trim().split(/\s+/)[0];
  if (!verify(csv, signature, 'data')) throw fail('signature', 'signature invalide (points01.csv)');

  return { text: csv.toString('latin1') };
}

// Vérifie une clé auprès du serveur en récupérant la signature : c'est la plus
// petite ressource protégée (64 octets), inutile de tirer tout le CSV pour
// savoir si la clé est acceptée.
// Renvoie { ok } ou { ok: false, code }.
async function checkKey(apiKey) {
  if (!apiKey) return { ok: false, code: 'nokey' };
  try {
    await download(SIG_URL, apiKey);
    return { ok: true };
  } catch (e) {
    return { ok: false, code: e.code || 'network' };
  }
}

// Nom de badge admissible : le renderer ne doit pas pouvoir faire remonter
// l'adresse ailleurs que dans le dossier des badges.
const BADGE_NAME = /^[a-z0-9_-]+\.(png|jpe?g|webp)$/i;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

// Télécharge un badge et le renvoie en data: URL.
//
// Les images ne sont pas chargées par <img src="https://…"> car une balise ne
// peut pas porter la clé API en en-tête — et la mettre dans l'adresse
// l'inscrirait dans les journaux du serveur. Le process principal les
// récupère donc lui-même.
async function fetchBadge(name, apiKey) {
  if (!BADGE_NAME.test(String(name || ''))) return null;
  const buf = await download(BADGES_URL + name, apiKey);
  const ext = name.split('.').pop().toLowerCase();
  return `data:${MIME[ext] || 'image/png'};base64,${buf.toString('base64')}`;
}

module.exports = {
  resolveTours,
  resolvePoints,
  checkKey,
  fetchBadge,
  TOURS_URL,
  POINTS_URL,
  BADGES_URL,
  ACCOUNT_URL,
};
