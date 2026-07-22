/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// main.js — process principal Electron.
//
// Rôle : création de la fenêtre, lecture des données (tours + aéroports)
// et exposition au renderer via l'IPC « get-data ». Gère aussi la
// connexion SimConnect (suivi des étapes) : sc-connect / sc-disconnect,
// la diffusion des événements 'sc-status' / 'sc-scan' vers le renderer,
// la progression signée (progress-store.js) et la clé API du compte
// cavva.sixk.me (api-key-store.js).
//
// Tours : téléchargés et vérifiés par tours-source.js (serveur exclusivement),
// avec la clé API en en-tête — sans clé acceptée, aucune donnée.
// Aéroports : airports-msfs.jsonl, à la racine du projet (dev) ou dans
// resources (build packagé).
// ============================================================

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const { parseToursText } = require('./tours-data');
const { parseAirports } = require('./airports-data');
const { SimConnectClient } = require('./simconnect');
const toursSource = require('./tours-source');
const progressStore = require('./progress-store');
const apiKeyStore = require('./api-key-store');

// Dossier des données source : racine du projet en dev, dossier resources
// (extraResources) une fois l'application packagée.
const DATA_DIR = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..', '..');
const AIRPORTS_FILE = path.join(DATA_DIR, 'airports-msfs.jsonl');

let mainWindow = null;
let cachedData = null;

const sim = new SimConnectClient();

// Diffuse un message IPC vers la fenêtre principale (si présente).
function broadcast(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

sim.on('status', (s) => broadcast('sc-status', s));
sim.on('scan', (frame) => broadcast('sc-scan', frame));

// Charge et met en cache l'ensemble { tours, airports }.
// Rien n'est mis en cache en cas d'échec : un nouvel appel réessaiera.
async function loadData() {
  if (cachedData) return cachedData;
  const { text } = await toursSource.resolveTours(apiKeyStore.get());
  const { tours, neededCodes } = parseToursText(text);
  console.log(`[tours] ${tours.length} tours téléchargés`);
  const airports = await parseAirports(AIRPORTS_FILE, neededCodes);
  cachedData = { tours, airports };
  return cachedData;
}

// Badges déjà téléchargés (nom de fichier → data: URL). Vidé en même temps
// que les tours quand la clé change : une autre clé, un autre accès.
const badgeCache = new Map();

function resetCaches() {
  cachedData = null;
  badgeCache.clear();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);

  // La console du renderer est invisible sans les outils de développement :
  // on la recopie dans le terminal, sinon une erreur d'interface passe
  // inaperçue. (L'avertissement CSP d'Electron en développement est écarté :
  // il n'apparaît pas dans l'application packagée.)
  mainWindow.webContents.on('console-message', (...args) => {
    const message = typeof args[1] === 'object' ? args[1].message : args[2];
    if (typeof message === 'string' && !/Electron Security Warning/.test(message)) {
      console.log('[renderer]', message);
    }
  });
  mainWindow.webContents.on('render-process-gone', (_e, d) => {
    console.error('[renderer] process interrompu :', d.reason);
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- IPC ---
// Échec de téléchargement : on renvoie un objet d'erreur plutôt que de
// rejeter. `code` permet au renderer de distinguer « clé absente ou refusée »
// (l'utilisateur doit saisir une clé) de « hors ligne » (il doit réessayer).
ipcMain.handle('get-data', async () => {
  try {
    return await loadData();
  } catch (e) {
    console.error(`[tours] téléchargement impossible (${e.code || 'network'}) :`, e.message);
    return { error: e.message || 'indisponible', code: e.code || 'network', tours: [], airports: {} };
  }
});

// Badge d'un tour, téléchargé avec la clé API et renvoyé en data: URL
// (une balise <img> ne peut pas porter d'en-tête d'authentification).
ipcMain.handle('badge-get', async (_e, name) => {
  if (badgeCache.has(name)) return badgeCache.get(name);
  try {
    const url = await toursSource.fetchBadge(name, apiKeyStore.get());
    if (url) badgeCache.set(name, url);
    return url;
  } catch (e) {
    console.error(`[badges] ${name} indisponible (${e.code || 'network'}) : ${e.message}`);
    return null;
  }
});

// --- Clé API du compte cavva.sixk.me ---
// La clé complète ne remonte jamais au renderer : seulement sa présence et
// une forme masquée.
ipcMain.handle('apikey-status', () => apiKeyStore.status());

// Enregistre une clé APRÈS l'avoir soumise au serveur : on ne garde jamais
// une clé dont on sait déjà qu'elle est refusée.
ipcMain.handle('apikey-set', async (_e, key) => {
  const propre = apiKeyStore.normalize(key);
  if (!propre) return { ok: false, code: 'malformed', status: apiKeyStore.status() };

  const res = await toursSource.checkKey(propre);
  if (!res.ok) return { ok: false, code: res.code, status: apiKeyStore.status() };

  if (!apiKeyStore.set(propre)) return { ok: false, code: 'write', status: apiKeyStore.status() };
  resetCaches(); // les tours seront retéléchargés avec la nouvelle clé
  console.log(`[clé API] enregistrée (${apiKeyStore.status().masked})`);
  return { ok: true, status: apiKeyStore.status() };
});

ipcMain.handle('apikey-clear', () => {
  const ok = apiKeyStore.clear();
  resetCaches();
  return { ok, status: apiKeyStore.status() };
});

// Ouverture de la page « Compte » dans le navigateur du système (adresse
// fixée par l'application, jamais fournie par le renderer).
ipcMain.handle('account-open', () => shell.openExternal(toursSource.ACCOUNT_URL));
ipcMain.handle('sc-connect', () => sim.connecter());
ipcMain.handle('sc-disconnect', () => sim.deconnecter());
ipcMain.handle('sc-status', () => ({ connected: sim.estConnecte() }));

// Progression signée (la clé HMAC reste dans le process principal).
ipcMain.handle('progress-get', () => progressStore.getAll());
ipcMain.handle('progress-set', (_e, tourId, entry) => progressStore.setTour(tourId, entry));
ipcMain.handle('progress-reset', (_e, tourId) => progressStore.resetTour(tourId));
ipcMain.handle('progress-import', (_e, entries) => progressStore.importLegacy(entries));

app.whenReady().then(() => {
  progressStore.init(app.getPath('userData'));
  apiKeyStore.init(app.getPath('userData'));

  // Trace de démarrage : sans clé, aucun tour ne sera téléchargé — autant
  // que ce soit lisible dans le terminal.
  const cle = apiKeyStore.status();
  console.log(
    `[clé API] ${cle.hasKey ? `${cle.masked} (${cle.encrypted ? 'chiffrée par le système' : 'EN CLAIR'})` : 'absente'}`
  );

  // Trace de démarrage : où est lue la progression et ce qu'elle contient.
  const snap = progressStore.getAll();
  const souci = snap.tampered
    ? ' — REJETÉE (signature invalide)'
    : snap.erreur
      ? ` — NON LUE (${snap.erreur})`
      : '';
  console.log(
    `[progression] ${path.join(app.getPath('userData'), 'progress.json')} — ` +
      `${Object.keys(snap.tours).length} tour(s)${souci}`
  );

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  try {
    sim.deconnecter();
  } catch (_) {}
  if (process.platform !== 'darwin') app.quit();
});
