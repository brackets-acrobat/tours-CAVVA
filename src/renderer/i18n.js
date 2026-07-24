/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// i18n.js — système de traductions bilingue FR / EN.
// Dictionnaire TRANSLATIONS, langue persistée (localStorage), application
// via attributs data-i18n (textContent) et data-i18n-title (title).
//
// CONVENTION : toute nouvelle chaîne d'UI ajoute sa clé dans fr ET en
// (jamais de texte en dur dans le HTML — sauf noms propres).
// TOUR_NAMES_EN traduit les intitulés de tours (données, hors data-i18n).
// ============================================================

const TRANSLATIONS = {
  fr: {
    appTitle: 'Suivi des tours',
    selectPlaceholder: 'Sélectionnez un tour',
    selectBtn: 'Sélectionner ce tour',
    awardsBtn: 'Badges et statistiques',
    apiKeyBtn: 'Clé API',
    toggleTitle: 'Changer de langue / Switch language',

    // Modale « À propos »
    aboutTitle: 'À propos',
    aboutVersion: 'Version {v}',
    aboutTagline: "L'appli de suivi des tours du Cercle Aéronautique Virtuel Vent Arrière.",
    aboutLicence: 'Ce logiciel est distribué sous licence GPL-3.0 ou ultérieure.',
    aboutSource: 'Le code source de cette application est disponible sur GitHub.',
    aboutCopyright: 'Copyright 2026 Cyril MILANI.',
    loading: 'Chargement des données…',
    legs: 'étapes',
    from: 'Départ',
    to: 'Arrivée',

    // Modale « Badges et statistiques »
    awardsTitle: 'Badges et statistiques',
    awardsBadgesTitle: 'Badges obtenus',
    awardsNone: 'Aucun tour terminé pour le moment.',
    statHours: 'Heures de vol',
    statDistance: 'Distance parcourue',
    statLegs: 'Étapes validées',
    statTours: 'Tours terminés',
    close: 'Fermer',
    progressTampered:
      'La progression enregistrée a été rejetée (fichier modifié). Les tours repartent de zéro.',
    toursUnavailable:
      'Impossible de télécharger les tours. Vérifiez votre connexion : les données sont servies en ligne, comme MSFS 2024.',
    missingCoords:
      "{n} point(s) d'étape sans coordonnées ({codes}) : les étapes concernées s'affichent sans tracé et ne peuvent pas être validées.",
    progressUnreadable:
      "La progression enregistrée n'a pas pu être lue. Elle n'est pas perdue : relancez l'application.",
    updateAvailable: 'Nouvelle version disponible : {latest} (vous utilisez la {current}).',
    updateDownload: 'Télécharger',
    newToursTitle: 'Nouveau(x) tour(s) disponible(s) :',
    retry: 'Réessayer',

    // Modale « Clé API »
    apiKeyTitle: 'Clé API du compte CAVVA',
    apiKeyIntro:
      "L'accès aux tours est réservé aux membres inscrits sur cavva.sixk.me. Générez une clé sur la page « Compte » du site, puis collez-la ici.",
    apiKeyOpenSite: 'Ouvrir la page Compte sur cavva.sixk.me',
    apiKeyLabel: 'Clé API',
    apiKeyPlaceholder: 'Collez votre clé ici',
    apiKeySave: 'Enregistrer et vérifier',
    apiKeyDelete: 'Supprimer la clé',
    apiKeyShow: 'Afficher la clé',
    apiKeyHide: 'Masquer la clé',
    apiKeyNone: 'Aucune clé enregistrée.',
    apiKeySaved: 'Clé enregistrée : {masked}',
    apiKeyPlain:
      "Le chiffrement du système est indisponible : la clé est enregistrée en clair sur ce poste.",
    apiKeyChecking: 'Vérification auprès du serveur…',
    apiKeyOk: 'Clé acceptée ✔',
    apiKeyBad: 'Clé refusée par le serveur. Vérifiez-la sur votre page « Compte ».',
    apiKeyMalformed: 'Format de clé invalide (8 caractères au minimum, sans espace).',
    apiKeyNetwork: "Serveur injoignable : la clé n'a pas pu être vérifiée. Réessayez.",
    apiKeyWriteError: "La clé n'a pas pu être enregistrée sur ce poste.",
    apiKeyDeleted: 'Clé supprimée.',
    apiKeyDeleteConfirm:
      "Supprimer la clé enregistrée ? L'application ne pourra plus télécharger les tours.",
    keyRequired:
      'Accès réservé aux membres : saisissez la clé API générée sur votre page « Compte » de cavva.sixk.me.',
    keyRejected:
      'Clé API refusée par le serveur (expirée, révoquée, ou compte non valide). Saisissez une clé valide.',
    enterKey: 'Saisir la clé',

    // Panneau des étapes
    startTour: 'Commencer le tour',
    continueTour: 'Continuer le tour',
    resetTour: 'Réinitialiser le tour',
    resetConfirm: 'Réinitialiser la progression de ce tour ? Toutes les étapes validées seront effacées.',
    startLeg: "Commencer l'étape",
    cancelLeg: 'Annuler la vérification',
    finishLeg: "Finaliser l'étape",
    colLeg: 'Étape',
    colFrom: 'Départ',
    colTo: 'Arrivée',
    colRegime: 'Régime de vol',
    colDist: 'Distance (nm)',

    // Statuts SimConnect / validation
    simConnecting: 'Connexion à MSFS 2024…',
    simFailed: 'MSFS 2024 introuvable (SimConnect indisponible). Lancez le simulateur puis réessayez.',
    awaitingDeparture: 'En attente de la position de départ (≤ 2,5 NM de {icao}, au sol)…',
    legEnroute: 'Étape {n} en cours — suivez votre trajet sur la carte.',
    legValidated: 'Étape {n} validée ✔',
    tourComplete: 'Tour terminé ! 🎉',
    notAtArrival: 'Non validé : {reasons}.',
    notSecured:
      "Non validé : à l'arrêt, 2 conditions sur 3 requises (frein serré, moteur coupé, vitesse < 5 kt). Manque : {reasons}.",
    reasonDistance: 'à {d} NM de {icao}',
    reasonEngine: 'moteur tournant',
    reasonBrake: 'frein de parking desserré',
    reasonSpeed: 'vitesse {kt} kt',
  },
  en: {
    appTitle: 'Tour tracker',
    selectPlaceholder: 'Select a tour',
    selectBtn: 'Select this tour',
    awardsBtn: 'Awards and statistics',
    apiKeyBtn: 'API key',
    toggleTitle: 'Changer de langue / Switch language',

    // About modal
    aboutTitle: 'About',
    aboutVersion: 'Version {v}',
    aboutTagline: 'The tour tracker of the Cercle Aéronautique Virtuel Vent Arrière.',
    aboutLicence: 'This software is distributed under the GPL-3.0-or-later licence.',
    aboutSource: "This application's source code is available on GitHub.",
    aboutCopyright: 'Copyright 2026 Cyril MILANI.',
    loading: 'Loading data…',
    legs: 'legs',
    from: 'Departure',
    to: 'Arrival',

    // Awards and statistics modal
    awardsTitle: 'Awards and statistics',
    awardsBadgesTitle: 'Awards earned',
    awardsNone: 'No tour completed yet.',
    statHours: 'Flight hours',
    statDistance: 'Distance flown',
    statLegs: 'Legs validated',
    statTours: 'Tours completed',
    close: 'Close',
    progressTampered:
      'Saved progress was rejected (file modified). All tours start over from scratch.',
    toursUnavailable:
      'Could not download the tours. Check your connection: the data is served online, just like MSFS 2024.',
    missingCoords:
      '{n} leg point(s) have no coordinates ({codes}): the legs concerned are drawn incomplete and cannot be validated.',
    progressUnreadable:
      'Saved progress could not be read. It is not lost: restart the application.',
    updateAvailable: 'A new version is available: {latest} (you are running {current}).',
    updateDownload: 'Download',
    newToursTitle: 'New tour(s) available:',
    retry: 'Retry',

    // API key modal
    apiKeyTitle: 'CAVVA account API key',
    apiKeyIntro:
      'Access to the tours is reserved for members registered on cavva.sixk.me. Generate a key on the site’s "Account" page, then paste it here.',
    apiKeyOpenSite: 'Open the Account page on cavva.sixk.me',
    apiKeyLabel: 'API key',
    apiKeyPlaceholder: 'Paste your key here',
    apiKeySave: 'Save and verify',
    apiKeyDelete: 'Remove key',
    apiKeyShow: 'Show the key',
    apiKeyHide: 'Hide the key',
    apiKeyNone: 'No key saved.',
    apiKeySaved: 'Saved key: {masked}',
    apiKeyPlain: 'System encryption is unavailable: the key is stored in clear text on this computer.',
    apiKeyChecking: 'Checking with the server…',
    apiKeyOk: 'Key accepted ✔',
    apiKeyBad: 'Key rejected by the server. Check it on your "Account" page.',
    apiKeyMalformed: 'Invalid key format (at least 8 characters, no spaces).',
    apiKeyNetwork: 'Server unreachable: the key could not be verified. Try again.',
    apiKeyWriteError: 'The key could not be saved on this computer.',
    apiKeyDeleted: 'Key removed.',
    apiKeyDeleteConfirm: 'Remove the saved key? The application will no longer be able to download the tours.',
    keyRequired:
      'Members only: enter the API key generated on your "Account" page at cavva.sixk.me.',
    keyRejected:
      'API key rejected by the server (expired, revoked, or invalid account). Enter a valid key.',
    enterKey: 'Enter the key',

    // Legs panel
    startTour: 'Start tour',
    continueTour: 'Continue tour',
    resetTour: 'Reset tour',
    resetConfirm: "Reset this tour's progress? All validated legs will be cleared.",
    startLeg: 'Start leg',
    cancelLeg: 'Cancel check',
    finishLeg: 'Finish leg',
    colLeg: 'Leg',
    colFrom: 'Departure',
    colTo: 'Arrival',
    colRegime: 'Flight rules',
    colDist: 'Distance (nm)',

    // SimConnect / validation statuses
    simConnecting: 'Connecting to MSFS 2024…',
    simFailed: 'MSFS 2024 not found (SimConnect unavailable). Start the simulator and try again.',
    awaitingDeparture: 'Waiting for departure position (≤ 2.5 NM from {icao}, on ground)…',
    legEnroute: 'Leg {n} in progress — follow your track on the map.',
    legValidated: 'Leg {n} validated ✔',
    tourComplete: 'Tour complete! 🎉',
    notAtArrival: 'Not validated: {reasons}.',
    notSecured:
      'Not validated: when stopped, 2 of 3 conditions required (parking brake set, engine off, speed < 5 kt). Missing: {reasons}.',
    reasonDistance: '{d} NM from {icao}',
    reasonEngine: 'engine running',
    reasonBrake: 'parking brake released',
    reasonSpeed: 'speed {kt} kt',
  },
};

// Intitulé FR (colonne 2 du CSV, trimé) -> intitulé EN.
const TOUR_NAMES_EN = {
  'Aeropostale (Reconstitution historique)': 'Aeropostale (Historical reenactment)',
  'Afrique IFR': 'Africa IFR',
  'Afrique du sud': 'South Africa',
  'Allemagne Benelux': 'Germany & Benelux',
  'Amérique du sud IFR': 'South America IFR',
  'Capitales européennes IFR': 'European capitals IFR',
  'Compostelle ULM': 'Compostela (ultralight)',
  Corse: 'Corsica',
  'Espagne Portugal': 'Spain & Portugal',
  France: 'France',
  'France - Madagascar (Reconstitution historique)': 'France - Madagascar (Historical reenactment)',
  'France IFR': 'France IFR',
  'France IFR avions legers': 'France IFR (light aircraft)',
  'France ULM': 'France (ultralight)',
  Grece: 'Greece',
  Italie: 'Italy',
  'Japon du nord au sud': 'Japan, north to south',
  'Maurice Noguès (Reconstitution historique)': 'Maurice Noguès (Historical reenactment)',
  'Moyen-Courrier': 'Medium-haul',
  'Méditerrranée IFR': 'Mediterranean IFR',
  'Nationale 7 en ULM': 'Route Nationale 7 (ultralight)',
  Norvege: 'Norway',
  'Nouvelle-Zelande': 'New Zealand',
  Provence: 'Provence',
  'Provinces chinoises IFR': 'Chinese provinces IFR',
  'Royaume-Uni': 'United Kingdom',
  Suisse: 'Switzerland',
  'Trail Appalaches': 'Appalachian Trail',
  'U.S.A IFR': 'U.S.A IFR',
};

// Langue courante (globale partagée entre les scripts du renderer).
let currentLang = localStorage.getItem('lang') || 'fr';

// Traduit une clé dans la langue courante.
function t(key) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.fr;
  return dict[key] != null ? dict[key] : key;
}

// Traduit avec substitution de paramètres {nom} → params.nom.
function tp(key, params) {
  return t(key).replace(/\{(\w+)\}/g, (m, k) => (params && params[k] != null ? params[k] : m));
}

// Libellé d'un tour dans la langue courante.
function tourLabel(tour) {
  if (currentLang === 'en') return TOUR_NAMES_EN[tour.name] || tour.name;
  return tour.name;
}

// Applique les traductions aux éléments porteurs de data-i18n / data-i18n-title.
function applyTranslations() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    // data-i18n-params (JSON) : message à trous, dont les valeurs doivent
    // survivre à la bascule de langue.
    let params = null;
    try {
      params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : null;
    } catch (_) {
      /* paramètres illisibles : message brut */
    }
    const key = el.getAttribute('data-i18n');
    el.textContent = params ? tp(key, params) : t(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
}

// Change la langue, persiste le choix et réapplique les traductions statiques.
// Les éléments dynamiques (dropdown, bandeau info) sont rafraîchis par les
// features via les hooks window._refresh* déclenchés dans lang-toggle.js.
function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  applyTranslations();
}
