/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// preload.js — pont sécurisé renderer ↔ main (contextIsolation).
// (Rappel : NE JAMAIS require() un module applicatif ici sous sandbox.)
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

// Abonne un callback à un canal ; renvoie une fonction de désabonnement.
function subscribe(channel, cb) {
  const h = (_e, p) => cb(p);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
}

contextBridge.exposeInMainWorld('tours', {
  // Données { tours, airports } (parsées côté main au premier appel).
  // En cas d'échec : { error, code } — voir tours-source.js.
  getData: () => ipcRenderer.invoke('get-data'),

  // Badge d'un tour en data: URL (téléchargé côté main, avec la clé API).
  badgeImage: (name) => ipcRenderer.invoke('badge-get', name),

  // Clé API du compte cavva.sixk.me. La clé complète ne redescend jamais
  // ici : apiKeyStatus() ne renvoie que { hasKey, masked, encrypted }.
  apiKeyStatus: () => ipcRenderer.invoke('apikey-status'),
  apiKeySet: (key) => ipcRenderer.invoke('apikey-set', key),
  apiKeyClear: () => ipcRenderer.invoke('apikey-clear'),
  openAccountPage: () => ipcRenderer.invoke('account-open'),

  // Modale « À propos » : dépôt du code source et version de l'application.
  openSource: () => ipcRenderer.invoke('source-open'),
  appVersion: () => ipcRenderer.invoke('app-version'),

  // Mise à jour : la question au démarrage, et l'ouverture de la page des
  // versions (adresse détenue par le process principal, cf. main.js).
  checkUpdate: () => ipcRenderer.invoke('update-check'),
  openReleases: () => ipcRenderer.invoke('releases-open'),

  // Progression et statistiques (signées côté main)
  progressGet: () => ipcRenderer.invoke('progress-get'),
  progressSet: (tourId, entry) => ipcRenderer.invoke('progress-set', tourId, entry),
  progressReset: (tourId) => ipcRenderer.invoke('progress-reset', tourId),
  progressImport: (entries) => ipcRenderer.invoke('progress-import', entries),

  // SimConnect (suivi des étapes)
  simConnect: () => ipcRenderer.invoke('sc-connect'),
  simDisconnect: () => ipcRenderer.invoke('sc-disconnect'),
  simStatus: () => ipcRenderer.invoke('sc-status'),
  onSimStatus: (cb) => subscribe('sc-status', cb),
  onSimScan: (cb) => subscribe('sc-scan', cb),
});
