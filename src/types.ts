export interface TurtleConfig {
  [key: string]: string | number | boolean | null
  host: string
  protocol: 'http' | 'https'
  verifyTls: boolean
  pollInterval: number
  timeout: number
}

export interface RawDanteChannel {
  type: string
  name: string
  id: number
  subdev?: string
  subchn?: string
  status?: string
  enable?: number
}

export interface RawDanteFlow {
  id: number
  name: string
  type: string
  manual: number
  addr: string[]
  slot: number[]
}

export interface RawDanteDevice {
  name: string
  unlicensed: number
  ol: number
  primac: string
  pristatic: number
  col: number
  priip: string
  primask: string
  prigw: string
  pridns: string
  prispeed: number
  secip: string
  secspeed: number
  manfname: string
  manfmodel: string
  modelver: string
  dantemodel: string
  owndep: number
  swver: string
  clksrc: string
  sync: string
  mute: number
  intfmode: number
  primultiv1: string
  primultiv2: string
  secmultiv1: string
  secmultiv2: string
  aes67spt: number
  aes67on: number
  aes67prefix: number
  clrconfspt: number
  preferredspt: number
  preferred: number
  aes67dev: number
  aes67src: string
  aes67sid: number
  aes67clk: number
  aes67pridest: string
  resetspt: number
  setratespt: number
  setencodingspt: number
  staticipspt: number
  pullupspt: number
  rxlatencylist: number[]
  rxlatencymin: number
  rxlatency: number
  rxlatencymax: number
  lock: number
  srate: number
  srate_array: number[]
  enc: number
  encs_array: number[]
  rxchn: RawDanteChannel[]
  txchn: RawDanteChannel[]
  txflow: RawDanteFlow[]
}

export interface DanteChannel {
  id: number
  name: string
  type: string
  sourceDevice: string
  sourceChannel: string
  status: string
  enabled: boolean
}

export interface DanteDevice {
  id: string
  name: string
  online: boolean
  lastSeen: number
  ip: string
  mac: string
  manufacturer: string
  model: string
  danteModel: string
  modelVersion: string
  softwareVersion: string
  clockSource: string
  clockStatus: string
  multicastPrimary: string
  multicastSecondary: string
  sampleRate: number
  encoding: number
  mute: boolean
  rxLatency: number
  rxLatencyMin: number
  rxLatencyMax: number
  rxChannels: DanteChannel[]
  txChannels: DanteChannel[]
  txFlows: RawDanteFlow[]
}

export interface DeviceCacheEntry extends DanteDevice {}

export interface RawDanteResponse {
  docver: number
  controller: { vip: string; vsm: string }
  dante: RawDanteDevice[]
}

export interface RawMxstaResponse {
  docver: number
  syssta: Record<string, unknown>
  netsta: Record<string, unknown>
  in: unknown[]
  out: unknown[]
  config: Record<string, unknown>
  vw: unknown[]
}

export interface RawTimeResponse {
  docver: number
  time: number
  tz: string
}
