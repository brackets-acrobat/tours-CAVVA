/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// update-check.js — « une version plus récente est-elle publiée ? »
//
// Interroge l'API publique des releases GitHub (aucune clé : le dépôt est
// public) et compare le dernier tag à la version de l'application. Ne télécharge
// rien et ne décide rien : renvoie { current, latest, newer }, au renderer de
// prévenir l'utilisateur, à l'utilisateur de télécharger.
//
// Volontairement silencieux sur l'échec (hors ligne, quota API, dépôt
// injoignable) : une mise à jour manquée n'est pas un incident, et l'appli ne
// doit jamais reprocher l'absence de réseau — elle est en ligne par nature,
// comme MSFS 2024. Un échec renvoie null.
//
// OWNER/REPO doivent suivre package.json (build.publish) et SOURCE_URL de
// main.js : c'est le même dépôt, servi au même endroit.
// ============================================================

const { app } = require('electron');

const OWNER = 'brackets-acrobat';
const REPO = 'tours-CAVVA';
const LATEST_API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
const TIMEOUT_MS = 5000;

// « 1.2.0 » → [1, 2, 0]. Un éventuel suffixe (-beta…) est ignoré : on ne compare
// que major.minor.patch. Un champ absent ou non numérique vaut 0.
function parts(v) {
  return String(v)
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

// latest est-il strictement postérieur à current ?
function isNewer(latest, current) {
  const L = parts(latest);
  const C = parts(current);
  for (let i = 0; i < 3; i++) {
    const l = L[i] || 0;
    const c = C[i] || 0;
    if (l !== c) return l > c;
  }
  return false;
}

// Renvoie { current, latest, newer } ou null si la question n'a pas pu être
// tranchée. L'endpoint /releases/latest exclut déjà brouillons et préversions.
async function checkForUpdate() {
  let res;
  try {
    res = await fetch(LATEST_API, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // GitHub refuse les requêtes sans User-Agent.
        'User-Agent': 'Tours-CAVVA',
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  } catch (e) {
    console.log(`[maj] vérification impossible (réseau) : ${e.message}`);
    return null;
  }
  if (!res.ok) {
    console.log(`[maj] vérification impossible : HTTP ${res.status}`);
    return null;
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const latest = String(json.tag_name || '').replace(/^v/i, '');
  if (!latest) return null;

  const current = app.getVersion();
  const newer = isNewer(latest, current);
  console.log(`[maj] version installée ${current}, dernière publiée ${latest}${newer ? ' — mise à jour disponible' : ''}`);
  return { current, latest, newer };
}

module.exports = { checkForUpdate, isNewer };
