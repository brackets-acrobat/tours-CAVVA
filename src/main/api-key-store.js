/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// api-key-store.js — clé API du compte cavva.sixk.me.
//
// L'utilisateur génère sa clé sur la page « Compte » du site et la colle
// dans l'application. Elle accompagne ensuite CHAQUE requête au serveur
// (tours, signature, badges) : c'est le serveur qui accorde ou refuse
// l'accès.
//
// Contrairement aux signatures HMAC de data-crypto.js, ce n'est donc pas de
// l'obfuscation : l'application n'a rien à vérifier elle-même, et une clé
// révoquée sur le site ne télécharge plus rien, quoi qu'on fasse du binaire.
//
// Stockage : <userData>/apikey.json, chiffré par le système quand c'est
// possible (safeStorage → DPAPI sous Windows). Le fichier est alors lié à la
// session Windows : recopié sur une autre machine, il est inutilisable.
// ============================================================

const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

const MIN_LEN = 8;
const MAX_LEN = 256;

let storePath = null; // défini par init() (dépend de app.getPath)
let cache; // undefined = pas encore lu ; null = pas de clé ; string = clé

function init(userDataDir) {
  storePath = path.join(userDataDir, 'apikey.json');
  cache = undefined;
}

// Forme attendue : caractères ASCII visibles, sans espace. On reste large —
// c'est le serveur qui décide de la validité, pas nous.
function normalize(key) {
  const s = String(key == null ? '' : key).trim();
  if (s.length < MIN_LEN || s.length > MAX_LEN) return null;
  if (!/^[\x21-\x7e]+$/.test(s)) return null;
  return s;
}

// Version affichable : « ABCD…WXYZ ». La clé complète ne remonte jamais au
// renderer, qui n'en a aucun usage.
function mask(key) {
  if (!key) return '';
  if (key.length < 12) return '•'.repeat(key.length);
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

// Renvoie { key, erreur } — key vaut null si aucune clé n'est enregistrée.
function read() {
  let raw;
  try {
    raw = fs.readFileSync(storePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { key: null }; // première exécution
    console.error(`[clé API] lecture impossible (${e.code}) : ${e.message}`);
    return { key: null, erreur: e.code || 'lecture' };
  }

  try {
    const file = JSON.parse(raw);
    if (file.enc) {
      if (!safeStorage.isEncryptionAvailable()) {
        console.error('[clé API] fichier chiffré mais le chiffrement système est indisponible');
        return { key: null, erreur: 'dechiffrement' };
      }
      return { key: normalize(safeStorage.decryptString(Buffer.from(file.value, 'base64'))) };
    }
    return { key: normalize(file.value) };
  } catch (e) {
    console.error(`[clé API] fichier illisible : ${e.message}`);
    return { key: null, erreur: 'illisible' };
  }
}

// Clé courante (ou null). Une lecture en échec n'est pas mémorisée : un
// fichier momentanément verrouillé ne doit pas condamner toute la session.
function get() {
  if (cache !== undefined) return cache;
  const { key, erreur } = read();
  if (!erreur) cache = key;
  return key;
}

// Enregistre la clé. Renvoie false si sa forme est inacceptable ou si
// l'écriture échoue (la vérification auprès du serveur est faite en amont,
// voir tours-source.checkKey).
function set(rawKey) {
  const key = normalize(rawKey);
  if (!key) return false;

  const chiffre = safeStorage.isEncryptionAvailable();
  const file = chiffre
    ? { v: 1, enc: true, value: safeStorage.encryptString(key).toString('base64') }
    : { v: 1, enc: false, value: key };

  try {
    const tmp = storePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(file), 'utf8');
    fs.renameSync(tmp, storePath); // remplacement atomique
  } catch (e) {
    console.error(`[clé API] écriture impossible : ${e.message}`);
    return false;
  }

  cache = key;
  return true;
}

function clear() {
  try {
    fs.unlinkSync(storePath);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error(`[clé API] suppression impossible : ${e.message}`);
      return false;
    }
  }
  cache = null;
  return true;
}

// État destiné au renderer : présence, forme masquée, et mode de stockage.
function status() {
  const key = get();
  return {
    hasKey: !!key,
    masked: mask(key),
    encrypted: safeStorage.isEncryptionAvailable(),
  };
}

module.exports = { init, get, set, clear, status, normalize, mask };
