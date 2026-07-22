/*
 * Tours CAVVA — Desktop
 * Copyright (C) 2026 Cyril MILANI — GPL-3.0-or-later
 */

// ============================================================
// simconnect.js — connexion SimConnect + lecture des SimVars utiles au
// suivi des tours (position, mouvement, moteur, frein de parking).
//
// Porté de la connexion éprouvée de NavXpressVFR / backcountry-desktop
// (protocole FSX_SP2, open() / addToDataDefinition / requestDataOnSimObject
// / 'simObjectData'). Le groupe est lu à SIM_FRAME puis émis vers le
// renderer au plus 2×/seconde ('scan') pour un tracé fluide sans inonder
// l'IPC. 'status' porte l'état de connexion.
//
// SimVars :
//   PLANE LATITUDE / PLANE LONGITUDE → position (tracé + vérifications)
//   GROUND VELOCITY                  → vitesse sol
//   SIM ON GROUND                    → au sol / en vol
//   BRAKE PARKING POSITION           → frein de parking (validation arrivée)
//   GENERAL ENG COMBUSTION:1 / :2    → moteur tournant (validation arrivée)
// ============================================================

const EventEmitter = require('events');
const {
  open: scOpen,
  Protocol: SCProtocol,
  SimConnectDataType: SCDataType,
  SimConnectPeriod: SCPeriod,
  SimConnectConstants: SCConst,
} = require('node-simconnect');

const SC_SCAN_DEF_ID = 1;
const SC_SCAN_REQ_ID = 1;

const UI_THROTTLE_MS = 500; // cadence d'émission vers le renderer (~2 Hz)

class SimConnectClient extends EventEmitter {
  constructor() {
    super();
    this._handle = null;
    this._connecting = false;
    this._lastUiEmit = 0;
  }

  estConnecte() {
    return !!this._handle;
  }

  async connecter() {
    if (this._handle) return { ok: true, alreadyConnected: true };
    if (this._connecting) return { ok: false, error: 'connect-in-progress' };

    this._connecting = true;
    this.emit('status', { state: 'connecting' });

    try {
      const { recvOpen, handle } = await scOpen('ToursCAVVA', SCProtocol.FSX_SP2);
      this._handle = handle;
      this._connecting = false;
      this.emit('status', { state: 'connected', app: recvOpen.applicationName });
      this._definirScan(handle);
      this._brancherEvenements(handle);
      return { ok: true };
    } catch (err) {
      this._connecting = false;
      this.emit('status', { state: 'disconnected', error: err && err.message });
      return { ok: false, error: err && err.message };
    }
  }

  async deconnecter() {
    if (this._handle) {
      try {
        this._handle.close();
      } catch (_) {}
      this._handle = null;
    }
    this.emit('status', { state: 'disconnected' });
  }

  // L'ORDRE des addToDataDefinition fixe l'ordre de lecture dans 'simObjectData'.
  _definirScan(handle) {
    handle.addToDataDefinition(SC_SCAN_DEF_ID, 'PLANE LATITUDE', 'degrees', SCDataType.FLOAT64);
    handle.addToDataDefinition(SC_SCAN_DEF_ID, 'PLANE LONGITUDE', 'degrees', SCDataType.FLOAT64);
    handle.addToDataDefinition(SC_SCAN_DEF_ID, 'GROUND VELOCITY', 'knots', SCDataType.FLOAT64);
    handle.addToDataDefinition(SC_SCAN_DEF_ID, 'SIM ON GROUND', 'Bool', SCDataType.INT32);
    handle.addToDataDefinition(SC_SCAN_DEF_ID, 'BRAKE PARKING POSITION', 'Bool', SCDataType.INT32);
    handle.addToDataDefinition(SC_SCAN_DEF_ID, 'GENERAL ENG COMBUSTION:1', 'Bool', SCDataType.INT32);
    handle.addToDataDefinition(SC_SCAN_DEF_ID, 'GENERAL ENG COMBUSTION:2', 'Bool', SCDataType.INT32);
    handle.addToDataDefinition(SC_SCAN_DEF_ID, 'PLANE HEADING DEGREES TRUE', 'degrees', SCDataType.FLOAT64);

    handle.requestDataOnSimObject(
      SC_SCAN_REQ_ID,
      SC_SCAN_DEF_ID,
      SCConst.OBJECT_ID_USER,
      SCPeriod.SIM_FRAME,
      0,
      0,
      0,
      0
    );
  }

  _brancherEvenements(handle) {
    handle.on('simObjectData', (data) => {
      if (data.requestID !== SC_SCAN_REQ_ID) return;
      try {
        // Lecture dans l'ordre EXACT de la définition ci-dessus.
        const lat = data.data.readFloat64();
        const lon = data.data.readFloat64();
        const groundSpeedKt = data.data.readFloat64();
        const onGround = data.data.readInt32() !== 0;
        const parkingBrake = data.data.readInt32() !== 0;
        const eng1 = data.data.readInt32() !== 0;
        const eng2 = data.data.readInt32() !== 0;
        const heading = data.data.readFloat64(); // cap vrai (degrés)

        const frame = {
          lat,
          lon,
          groundSpeedKt,
          onGround,
          parkingBrake,
          engineOn: eng1 || eng2,
          heading,
          t: Date.now(),
        };

        // Throttle pour l'UI (renderer).
        if (frame.t - this._lastUiEmit >= UI_THROTTLE_MS) {
          this._lastUiEmit = frame.t;
          this.emit('scan', frame);
        }
      } catch (err) {
        this.emit('status', { state: 'connected', warn: 'lecture KO: ' + (err && err.message) });
      }
    });

    handle.on('exception', (ex) => {
      this.emit('status', { state: 'connected', warn: 'exception SimConnect: ' + JSON.stringify(ex) });
    });

    const onPerte = () => {
      this._handle = null;
      this.emit('status', { state: 'disconnected' });
    };
    handle.on('quit', onPerte);
    handle.on('close', onPerte);
  }
}

module.exports = { SimConnectClient };
