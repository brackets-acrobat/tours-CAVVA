# Tours CAVVA

Application desktop (Electron) pour suivre les tours aéronautiques VFR/IFR de
Microsoft Flight Simulator 2024. Bilingue FR/EN.

## Lancer / Run

```bash
npm install
npm start
```

Si `npm start` renvoie « Electron failed to install correctly » (échec
silencieux d'extraction du binaire sous Windows) :

```bash
npm run force-electron
```

## Utilisation

- **Menu déroulant** (haut gauche) : liste des tours (intitulé, colonne 2 de `tours01.csv`).
- **Sélectionner ce tour / Select this tour** : trace l'itinéraire et ouvre la
  vue scindée (tableau des étapes à gauche 1/3, carte à droite 2/3).
- **Badges et statistiques / Awards and statistics** : totaux tous tours confondus
  (heures de vol, distance parcourue, étapes validées, tours terminés) et badges
  des tours entièrement terminés, servis par le serveur.
- **Clé API / API key** (haut droite) : saisie de la clé du compte cavva.sixk.me
  (voir « Accès réservé aux membres »).
- **Toggle FR/EN** (haut droite) : bascule la langue de l'interface et des noms de tours.
- **Carte** : OpenStreetMap par défaut, OpenTopoMap via le sélecteur de calques (coin de la carte).
- Points rouges Ø 10 px sur les aéroports, ligne rouge 3 px pour le tracé.
  Chaque étape porte une **flèche de sens** (départ → arrivée) et un **numéro
  séquentiel** (1, 2, 3 …). La carte se centre automatiquement sur le tour entier.

## Suivi d'un tour (SimConnect)

Le panneau gauche liste les étapes (numéro, ICAO départ/arrivée, distance nm) et
pilote la progression, connectée à MSFS 2024 via SimConnect :

1. **Commencer le tour** (ou **Continuer le tour** si déjà entamé) sélectionne
   l'étape courante (première non validée).
2. **Commencer l'étape** connecte MSFS et attend que l'appareil soit **au sol à
   ≤ 2,5 NM** de l'aéroport de départ. Une fois vérifié, l'étape passe « en cours »,
   le bouton devient **Finaliser l'étape**, et le trajet parcouru se trace en bleu
   (marqueur avion suivi en temps réel).
3. À l'arrivée, **Finaliser l'étape** valide si l'appareil est **≤ 2,5 NM de
   l'arrivée, moteur coupé et frein de parking serré**. L'étape passe alors en
   **grisé**, et l'étape suivante devient courante.
4. La progression est **persistée et signée** (voir « Progression protégée ») : à la
   réouverture du tour, les étapes validées restent grisées et le bouton propose
   « Continuer le tour ». Le temps et la distance réellement volés sont
   enregistrés par étape et alimentent « Badges et statistiques ».

MSFS 2024 doit être lancé pour l'étape 2 ; sinon un message invite à démarrer le
simulateur (le reste de l'app — carte, tableau, distances — fonctionne sans).

## Structure du projet

```
src/
├── main/                     Process principal Electron
│   ├── main.js               Fenêtre + IPC + chargement des données + SimConnect
│   ├── tours-data.js         Parsing des tours (regroupement par intitulé) + badges
│   ├── airports-data.js      Extraction streaming des coordonnées (airports-msfs.jsonl)
│   ├── tours-source.js       Téléchargement signé des tours (aucun repli local)
│   ├── api-key-store.js      Clé API du compte (<userData>/apikey.json, chiffrée)
│   ├── data-crypto.js        Signatures HMAC-SHA256 (données + progression)
│   ├── progress-store.js     Progression signée (<userData>/progress.json)
│   └── simconnect.js         Client SimConnect (position, moteur, frein de parking)
├── preload.js                Pont sécurisé window.tours (contextIsolation)
├── img/                      Sources des badges à téléverser (non embarquées)
└── renderer/
    ├── index.html            Structure + ordre de chargement des scripts
    ├── styles.css            Styles
    ├── i18n.js               Traductions FR/EN (t, tp, setLanguage, data-i18n)
    ├── renderer.js           Orchestrateur (câble les fonctionnalités)
    ├── js/features/          Un fichier par fonctionnalité
    │   ├── map.js            Carte Leaflet + fonds OSM/OpenTopoMap
    │   ├── route.js          Tracé du tour : points, lignes, recentrage, bandeau info
    │   ├── leg-arrows.js     Sens des étapes (flèches) + numérotation séquentielle
    │   ├── tour-panel.js     Panneau des étapes : tableau, distances, progression persistée
    │   ├── sim-tracking.js   Suivi SimConnect : vérif départ/arrivée, tracé live, validation
    │   ├── tour-select.js    Menu déroulant + bouton « Sélectionner ce tour »
    │   ├── awards.js         Modale « Badges et statistiques »
    │   ├── api-key.js        Modale « Clé API » (saisie, vérification serveur)
    │   └── lang-toggle.js    Bascule FR/EN
    └── vendor/leaflet/       Bibliothèque Leaflet (vendorisée, hors ligne)
```

## Données

Lues au démarrage par le process principal :

- `tours01.csv` — téléchargé (voir « Données servies en ligne »).
  Encodage Windows-1252, séparateur `;`. Groupé par la colonne 2
  (intitulé). La colonne 1 (`FR001`, `SW001`…) n'est qu'un identifiant unique
  d'étape ; la numérotation affichée est séquentielle par tour.
- `airports-msfs.jsonl` — ~70 Mo, lu en streaming ; seuls les aéroports
  référencés par les tours sont conservés (recherche par `icao_code`, `ident`,
  `gps_code`, `local_code`). Non sensible et trop volumineux pour être
  téléchargé : il reste copié dans les `resources` de l'app
  (`extraResources`), résolu via `process.resourcesPath`.

## Données servies en ligne

Tours et badges viennent **exclusivement du serveur** — aucune copie locale,
aucun cache. MSFS 2024 fonctionnant en streaming, sans connexion il n'y a de
toute façon pas de simulateur. Corriger une étape, ajouter un tour ou changer
un badge ne demande donc **ni reconstruction ni redistribution**.

| Ressource | Adresse |
| --- | --- |
| Tours | `https://cavva.sixk.me/tours-cavva/tours01.csv` |
| Signature | `https://cavva.sixk.me/tours-cavva/tours01.csv.sig` |
| Badges | `https://cavva.sixk.me/badges/<prefixe>.png` |

Le CSV n'est accepté que si la signature HMAC-SHA256 publiée à côté
correspond : un serveur détourné (fichier `hosts`, proxy) ne peut pas injecter
d'autres tours. En cas d'échec — hors ligne, serveur muet, signature invalide —
l'application affiche un bandeau avec un bouton **Réessayer**, sans se fermer.

Chaque requête porte la clé API de l'utilisateur (voir la section suivante) :
tours, signature et badges sont réservés aux membres inscrits.

Le nom du badge d'un tour est déduit du préfixe de ses codes d'étapes
(`FR001` → `fr.png`). Les écarts éventuels se déclarent dans `BADGE_OVERRIDES`
(`src/main/tours-data.js`) — un seul aujourd'hui : `JNS001` → `jn.png`.

### Publier une mise à jour des tours

```bash
npm run sign-data
```

puis déposer **les deux fichiers** côte à côte sur le serveur : `tours01.csv` et
`tours01.csv.sig`. Le script refuse de signer un CSV qui ne produit aucun tour
et vérifie au passage que les badges de tous les tours sont bien en ligne.
`npm run dist` régénère la signature automatiquement.

`src/img/` n'est plus embarqué dans l'application : ce dossier ne sert qu'à
conserver les images sources à téléverser.

## Accès réservé aux membres (clé API)

L'accès aux tours est réservé aux membres inscrits sur cavva.sixk.me. Le
bouton **Clé API** (barre du haut, à gauche du bascule FR/EN) ouvre une modale
où l'utilisateur colle la clé générée sur sa page **Compte** du site.

1. La clé saisie est d'abord **soumise au serveur** (requête sur
   `tours01.csv.sig`, la plus petite ressource protégée). Elle n'est
   enregistrée que si le serveur l'accepte : une clé fausse ne s'installe pas.
2. Elle accompagne ensuite **chaque requête** — tours, signature, badges — dans
   deux en-têtes : `Authorization: Bearer <clé>` et `X-API-Key: <clé>`.
3. Sans clé, ou si le serveur répond **401/403**, l'application n'affiche aucun
   tour : bandeau explicite et modale ouverte d'office. Le message distingue
   « clé absente », « clé refusée » et « serveur injoignable » — trois
   situations que l'utilisateur ne corrige pas de la même manière.

La clé est stockée dans `<userData>/apikey.json`, **chiffrée par le système**
quand c'est possible (`safeStorage` → DPAPI sous Windows) : le fichier est
alors lié à la session Windows et inutilisable recopié ailleurs. Elle ne
redescend jamais dans le renderer, qui n'en reçoit qu'une forme masquée
(`CAVV…ef56`). Les badges sont téléchargés par le process principal et rendus
en `data:` URL, car une balise `<img>` ne peut pas porter d'en-tête — et mettre
la clé dans l'adresse l'inscrirait dans les journaux du serveur.

Le terminal indique au démarrage : `[clé API] cavv…ef56 (chiffrée par le
système)` ou `[clé API] absente`.

### Le contrôle côté serveur

**Sans contrôle côté serveur, la clé ne protégerait rien** : les fichiers
resteraient téléchargeables par n'importe qui. C'est la seule partie du
dispositif qui n'est pas de l'obfuscation.

Il est implémenté dans le projet du site (`Documents/Dev/CAVVA`) :

| Ressource | Contrôle |
| --- | --- |
| `/tours-cavva/tours01.csv` | `ToursCavvaController::donnees` → 401 sans clé valide |
| `/tours-cavva/tours01.csv.sig` | idem |
| `/badges/*.png` | `ToursCavvaController::badge` → 401 sans clé valide |

Les fichiers y vivent sous `storage/tours-cavva/`, **hors du dossier public** :
Apache ne les sert jamais directement, comme les pièces jointes des vols
d'aéroclub. Le membre génère sa clé depuis sa page « Compte » (une seule active
à la fois, révocable) ; seule son empreinte SHA-256 est conservée en base, et un
compte suspendu perd l'accès immédiatement.

Publier une mise à jour revient donc à déposer `tours01.csv`, `tours01.csv.sig`
et les badges dans `storage/tours-cavva/` sur le serveur.

### Essai en local

`CAVVA_BASE_URL` remplace `https://cavva.sixk.me` le temps d'un essai, pour
viser une instance de développement du site :

```powershell
$env:CAVVA_BASE_URL = "http://localhost/cavva"; npm start
```

La signature du CSV reste vérifiée : un serveur d'essai ne peut pas injecter
d'autres tours.

`npm run sign-data` interroge le serveur pour vérifier que les badges sont en
ligne ; si le dossier est protégé, poser la clé dans l'environnement :

```powershell
$env:CAVVA_API_KEY = "votre-clé"
```

## Progression protégée

Au démarrage, le terminal indique où la progression est lue et ce qu'elle
contient — `10 tour(s)`, `REJETÉE (signature invalide)` ou `NON LUE (CODE)` —
et la console du renderer y est recopiée : une erreur d'interface ne peut plus
passer inaperçue.

Pour peupler l'application sans voler les étapes (démonstration, captures) :

```bash
npm run demo-progress            # 9 tours terminés + 1 en cours
npm run demo-progress -- --effacer
```

L'ancienne progression est sauvegardée en `progress.json.avant-demo`.


La progression n'est pas dans `localStorage` mais dans
`<userData>/progress.json`, accompagnée d'une signature HMAC-SHA256 calculée
dans le process principal (la clé n'est jamais exposée au renderer). Un fichier
modifié à la main est rejeté au démarrage : la progression repart de zéro et un
bandeau d'avertissement s'affiche. Les progressions de l'ancien stockage
`localStorage` sont reprises automatiquement à la première exécution.

> Ces protections sont de l'**obfuscation**, pas de la sécurité : l'application
> devant signer et vérifier seule, les clés sont dérivées d'un secret présent
> dans le code (`src/main/data-crypto.js`). Cela empêche la modification d'un
> fichier au bloc-notes et la substitution des tours par un serveur détourné,
> pas la rétro-ingénierie de l'archive `asar`. La seule garantie réelle est la
> validation côté serveur — c'est le rôle de la clé API ci-dessus.
