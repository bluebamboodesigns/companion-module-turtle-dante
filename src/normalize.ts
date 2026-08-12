import type { DanteDevice, RawDanteDevice } from './types.js'

export function normalizeMac(mac: string): string {
  return mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
}

export function normalizeDevice(raw: RawDanteDevice, previous?: DanteDevice): DanteDevice {
  const id = normalizeMac(raw.primac)
  return {
    id,
    name: raw.name,
    online: raw.ol === 1,
    lastSeen: Date.now(),
    ip: raw.priip,
    mac: previous?.mac ?? raw.primac,
    manufacturer: raw.manfname,
    model: raw.manfmodel,
    danteModel: raw.dantemodel,
    modelVersion: raw.modelver,
    softwareVersion: raw.swver,
    clockSource: raw.clksrc,
    clockStatus: raw.sync,
    multicastPrimary: raw.primultiv1,
    multicastSecondary: raw.primultiv2,
    sampleRate: raw.srate,
    encoding: raw.enc,
    mute: raw.mute === 1,
    rxLatency: raw.rxlatency,
    rxLatencyMin: raw.rxlatencymin,
    rxLatencyMax: raw.rxlatencymax,
    rxChannels: raw.rxchn.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      sourceDevice: ch.subdev ?? '',
      sourceChannel: ch.subchn ?? '',
      status: ch.status ?? 'UNKNOWN',
      enabled: ch.enable === undefined ? true : ch.enable === 1,
    })),
    txChannels: raw.txchn.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      sourceDevice: '',
      sourceChannel: '',
      status: 'TX',
      enabled: ch.enable === undefined ? true : ch.enable === 1,
    })),
    txFlows: raw.txflow ?? [],
  }
}
