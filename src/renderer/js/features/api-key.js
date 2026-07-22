/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// api-key.js — modale « Clé API ».
//
// L'accès aux tours est réservé aux membres inscrits sur cavva.sixk.me :
// l'utilisateur génère une clé sur la page « Compte » du site et la colle
// ici. La clé est soumise au SERVEUR avant d'être enregistrée — le renderer
// ne juge rien lui-même, et ne détient jamais la clé complète : le process
// principal ne lui renvoie qu'une forme masquée (voir api-key-store.js).
//
// La modale s'ouvre d'elle-même au démarrage quand aucune clé n'est
// enregistrée ou quand le serveur la refuse : sans clé, l'application n'a
// aucun tour à montrer.
// ============================================================

// Dernier état connu, renvoyé par le process principal.
let apiKeyState = { hasKey: false, masked: '', encrypted: true };

function apiKeyModal() {
  return document.getElementById('apiKeyModal');
}

// --- Affichage ---------------------------------------------------------------

// Ligne d'état : clé enregistrée (masquée) ou absence de clé.
function renderApiKeyState() {
  const el = document.getElementById('apiKeyState');
  if (apiKeyState.hasKey) {
    el.textContent = tp('apiKeySaved', { masked: apiKeyState.masked });
    // Sans chiffrement système, la clé est en clair sur le disque : l'utilisateur
    // doit le savoir plutôt que de le découvrir.
    if (!apiKeyState.encrypted) el.textContent += ' — ' + t('apiKeyPlain');
  } else {
    el.textContent = t('apiKeyNone');
  }
  document.getElementById('apiKeyDelete').hidden = !apiKeyState.hasKey;
}

// Message de retour. `kind` : 'ok' | 'bad' | 'info'. La clé i18n est mémorisée
// dans data-i18n pour être retraduite à la bascule de langue.
function setApiKeyFeedback(key, kind) {
  const el = document.getElementById('apiKeyFeedback');
  if (!key) {
    el.hidden = true;
    el.textContent = '';
    delete el.dataset.i18n;
    return;
  }
  el.dataset.i18n = key;
  el.textContent = t(key);
  el.className = 'form-feedback ' + (kind || 'info');
  el.hidden = false;
}

async function refreshApiKeyState() {
  apiKeyState = (await window.tours.apiKeyStatus()) || { hasKey: false, masked: '', encrypted: true };
  renderApiKeyState();
}

// Re-rend la ligne d'état (elle contient un paramètre, donc hors data-i18n).
function refreshApiKeyPanel() {
  if (!apiKeyModal().hidden) renderApiKeyState();
}
window._refreshApiKey = refreshApiKeyPanel;

// --- Ouverture / fermeture ---------------------------------------------------

function openApiKey() {
  setApiKeyFeedback(null);
  apiKeyModal().hidden = false;
  refreshApiKeyState();
  document.getElementById('apiKeyInput').focus();
}
window._openApiKey = openApiKey;

function closeApiKey() {
  apiKeyModal().hidden = true;
  document.getElementById('apiKeyInput').value = '';
}

// --- Enregistrement ----------------------------------------------------------

// Codes renvoyés par le process principal → clés de message.
const API_KEY_ERRORS = {
  malformed: 'apiKeyMalformed',
  unauthorized: 'apiKeyBad',
  nokey: 'apiKeyMalformed',
  network: 'apiKeyNetwork',
  write: 'apiKeyWriteError',
};

function setApiKeyBusy(busy) {
  document.getElementById('apiKeySave').disabled = busy;
  document.getElementById('apiKeyDelete').disabled = busy;
  document.getElementById('apiKeyInput').disabled = busy;
}

async function saveApiKey() {
  const input = document.getElementById('apiKeyInput');
  setApiKeyBusy(true);
  setApiKeyFeedback('apiKeyChecking', 'info');

  let res;
  try {
    res = await window.tours.apiKeySet(input.value);
  } catch (e) {
    console.error('Enregistrement de la clé interrompu :', e && (e.message || e));
    res = { ok: false, code: 'network' };
  }
  setApiKeyBusy(false);

  if (res && res.status) {
    apiKeyState = res.status;
    renderApiKeyState();
  }

  if (!res || !res.ok) {
    setApiKeyFeedback(API_KEY_ERRORS[res && res.code] || 'apiKeyNetwork', 'bad');
    return;
  }

  setApiKeyFeedback('apiKeyOk', 'ok');
  input.value = '';
  // La clé a changé : les tours sont retéléchargés avec elle. On laisse le ✔
  // visible un instant avant de refermer.
  setTimeout(closeApiKey, 600);
  if (typeof window._reloadTours === 'function') window._reloadTours();
}

async function deleteApiKey() {
  if (!window.confirm(t('apiKeyDeleteConfirm'))) return;
  setApiKeyBusy(true);
  const res = await window.tours.apiKeyClear();
  setApiKeyBusy(false);
  if (res && res.status) apiKeyState = res.status;
  renderApiKeyState();
  setApiKeyFeedback('apiKeyDeleted', 'info');
}

// --- Câblage -----------------------------------------------------------------

function initApiKey() {
  document.getElementById('apiKeyBtn').addEventListener('click', openApiKey);
  document.getElementById('apiKeyClose').addEventListener('click', closeApiKey);
  document.getElementById('apiKeyBackdrop').addEventListener('click', closeApiKey);
  document.getElementById('apiKeySave').addEventListener('click', saveApiKey);
  document.getElementById('apiKeyDelete').addEventListener('click', deleteApiKey);
  document.getElementById('apiKeySite').addEventListener('click', () => window.tours.openAccountPage());

  // Entrée dans le champ = enregistrer (le formulaire n'a qu'un champ).
  document.getElementById('apiKeyInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveApiKey();
  });

  // Œil : afficher / masquer la clé saisie (relecture d'un copier-coller).
  const reveal = document.getElementById('apiKeyReveal');
  reveal.addEventListener('click', () => {
    const input = document.getElementById('apiKeyInput');
    const shown = input.type === 'text';
    input.type = shown ? 'password' : 'text';
    reveal.dataset.i18nTitle = shown ? 'apiKeyShow' : 'apiKeyHide';
    reveal.title = t(reveal.dataset.i18nTitle);
    input.focus();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !apiKeyModal().hidden) closeApiKey();
  });

  refreshApiKeyState();
}
