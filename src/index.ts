import {
  combineRgb,
  InstanceBase,
  InstanceStatus,
  type CompanionActionDefinitions,
  type CompanionActionEvent,
  type CompanionActionSchemaWithoutResult,
  type CompanionFeedbackDefinitions,
  type CompanionFeedbackBooleanEvent,
  type CompanionFeedbackSchema,
  type CompanionPresetDefinitions,
  type CompanionVariableDefinitions,
  type SomeCompanionConfigField,
} from '@companion-module/base'
import { TurtleApi } from './api.js'
import { normalizeDevice } from './normalize.js'
import type { DanteDevice, TurtleConfig } from './types.js'

interface Types {
  config: TurtleConfig
  secrets: undefined
  actions: {
    route: CompanionActionSchemaWithoutResult<{ destination: string; source: string }>
    refresh: CompanionActionSchemaWithoutResult<Record<string, never>>
  }
  feedbacks: {
    deviceOnline: CompanionFeedbackSchema<{ device: string }> & { type: 'boolean' }
    deviceOffline: CompanionFeedbackSchema<{ device: string }> & { type: 'boolean' }
    deviceClockSynced: CompanionFeedbackSchema<{ device: string }> & { type: 'boolean' }
    deviceClockUnsynced: CompanionFeedbackSchema<{ device: string }> & { type: 'boolean' }
    deviceMuted: CompanionFeedbackSchema<{ device: string }> & { type: 'boolean' }
    destinationSource: CompanionFeedbackSchema<{ device: string; channel: number; sourceDevice: string; sourceChannel: string }> & { type: 'boolean' }
    destinationStatus: CompanionFeedbackSchema<{ device: string; channel: number; status: string }> & { type: 'boolean' }
  }
  variables: Record<string, string | number | boolean | undefined>
}

export default class TurtleDanteInstance extends InstanceBase<Types> {
  private config!: TurtleConfig
  private api?: TurtleApi
  private pollTimer?: NodeJS.Timeout
  private polling = false
  private devices = new Map<string, DanteDevice>()
  private controllerOnline = false

  public async init(config: TurtleConfig, _isFirstInit: boolean, _secrets: undefined): Promise<void> {
    this.config = config
    this.defineStaticCapabilities()
    await this.start()
  }

  public async configUpdated(config: TurtleConfig, _secrets: undefined): Promise<void> {
    this.config = config
    await this.start()
  }

  public async destroy(): Promise<void> {
    this.stopPolling()
    this.api = undefined
  }

  private async start(): Promise<void> {
    this.stopPolling()
    this.api = new TurtleApi(this.config)
    this.updateStatus(InstanceStatus.Connecting)
    await this.poll(true)
    this.pollTimer = setInterval(() => void this.poll(false), Math.max(1000, this.config.pollInterval || 2000))
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = undefined
  }

  private async poll(initial: boolean): Promise<void> {
    if (!this.api || this.polling) return
    this.polling = true
    try {
      const response = await this.api.getDante()
      this.controllerOnline = true
      const seen = new Set<string>()

      for (const raw of response.dante ?? []) {
        const device = normalizeDevice(raw, this.devices.get(raw.primac))
        seen.add(device.id)
        this.devices.set(device.id, device)
      }

      for (const [id, device] of this.devices) {
        if (!seen.has(id)) this.devices.set(id, { ...device, online: false })
      }

      this.updateStatus(InstanceStatus.Ok, `${this.onlineCount()} Dante device${this.onlineCount() === 1 ? '' : 's'} online`)
      this.refreshDynamicDefinitions()
      this.updateVariables()
      this.checkAllFeedbacks()
    } catch (error) {
      this.controllerOnline = false
      this.updateStatus(InstanceStatus.ConnectionFailure, error instanceof Error ? error.message : String(error))
      this.updateVariables()
      this.checkAllFeedbacks()
      if (initial) this.log('error', `Unable to connect to Turtle controller: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      this.polling = false
    }
  }

  private onlineCount(): number {
    return [...this.devices.values()].filter((d) => d.online).length
  }

  private defineStaticCapabilities(): void {
    this.setActionDefinitions(this.buildActions())
    this.setFeedbackDefinitions(this.buildFeedbacks())
    this.setVariableDefinitions(this.buildVariables())
    this.setPresetDefinitions([], this.buildPresets())
  }

  private refreshDynamicDefinitions(): void {
    this.setActionDefinitions(this.buildActions())
    this.setFeedbackDefinitions(this.buildFeedbacks())
    this.setVariableDefinitions(this.buildVariables())
    this.setPresetDefinitions([], this.buildPresets())
  }

  private deviceChoices(includeOffline = true) {
    return [...this.devices.values()]
      .filter((d) => includeOffline || d.online)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({ id: d.id, label: `${d.name}${d.online ? '' : ' (OFFLINE)'}` }))
  }


  private allChannelChoices(direction: 'rx' | 'tx') {
    const choices: Array<{ id: string; label: string }> = []
    for (const d of [...this.devices.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const channels = direction === 'rx' ? d.rxChannels : d.txChannels
      for (const ch of channels) {
        choices.push({ id: `${d.id}:${ch.id}`, label: `${d.name} / ${ch.name} (CH ${ch.id})${d.online ? '' : ' (OFFLINE)'}` })
      }
    }
    return choices
  }
  private buildActions(): CompanionActionDefinitions<Types['actions']> {
    const actions: CompanionActionDefinitions<Types['actions']> = {
      refresh: {
        name: 'Refresh Dante inventory',
        options: [],
        hasResult: false,
        callback: async () => {
          await this.poll(false)
        },
      },
      route: {
        name: 'Route Dante source to destination',
        options: [
          {
            type: 'dropdown',
            id: 'source',
            label: 'Source TX channel',
            default: '',
            choices: this.allChannelChoices('tx'),
          },
          {
            type: 'dropdown',
            id: 'destination',
            label: 'Destination RX channel',
            default: '',
            choices: this.allChannelChoices('rx'),
          },
        ],
        hasResult: false,
        callback: async (event: CompanionActionEvent<Types['actions']['route']['options']>) => {
          const [destinationId, destinationChannelText] = String(event.options.destination).split(':')
          const [sourceId, sourceChannelText] = String(event.options.source).split(':')
          const destination = this.devices.get(destinationId)
          const source = this.devices.get(sourceId)
          if (!destination || !source) throw new Error('Selected Dante device is not in the cache')
          const destinationChannel = Number(destinationChannelText)
          const sourceChannel = Number(sourceChannelText)
          if (!Number.isInteger(destinationChannel) || !Number.isInteger(sourceChannel)) throw new Error('Invalid Dante channel selection')
          await this.api?.route(destination.name, destinationChannel, source.name, sourceChannel)
          await this.poll(false)
        },
      },
    }
    return actions
  }

  private buildFeedbacks(): CompanionFeedbackDefinitions<Types['feedbacks']> {
    const deviceChoices = this.deviceChoices()
    const feedbacks: CompanionFeedbackDefinitions<Types['feedbacks']> = {
      deviceOnline: {
        type: 'boolean', name: 'Dante device is online', defaultStyle: { bgcolor: combineRgb(0, 160, 0) },
        options: [{ type: 'dropdown', id: 'device', label: 'Device', default: '', choices: deviceChoices }],
        callback: (event: CompanionFeedbackBooleanEvent<Types['feedbacks']['deviceOnline']['options']>) =>
          this.devices.get(String(event.options.device))?.online === true,
      },
      deviceOffline: {
        type: 'boolean', name: 'Dante device is offline', defaultStyle: { bgcolor: combineRgb(160, 0, 0) },
        options: [{ type: 'dropdown', id: 'device', label: 'Device', default: '', choices: deviceChoices }],
        callback: (event: CompanionFeedbackBooleanEvent<Types['feedbacks']['deviceOffline']['options']>) => {
          const d = this.devices.get(String(event.options.device))
          return d !== undefined && !d.online
        },
      },
      deviceClockSynced: {
        type: 'boolean', name: 'Dante device clock is synced', defaultStyle: { bgcolor: combineRgb(0, 160, 0) },
        options: [{ type: 'dropdown', id: 'device', label: 'Device', default: '', choices: deviceChoices }],
        callback: (event: CompanionFeedbackBooleanEvent<Types['feedbacks']['deviceClockSynced']['options']>) =>
          this.devices.get(String(event.options.device))?.clockStatus === 'SYNC',
      },
      deviceClockUnsynced: {
        type: 'boolean', name: 'Dante device clock is not synced', defaultStyle: { bgcolor: combineRgb(160, 0, 0) },
        options: [{ type: 'dropdown', id: 'device', label: 'Device', default: '', choices: deviceChoices }],
        callback: (event: CompanionFeedbackBooleanEvent<Types['feedbacks']['deviceClockUnsynced']['options']>) => {
          const d = this.devices.get(String(event.options.device))
          return d !== undefined && d.online && d.clockStatus !== 'SYNC'
        },
      },
      deviceMuted: {
        type: 'boolean', name: 'Dante device is muted', defaultStyle: { bgcolor: combineRgb(160, 80, 0) },
        options: [{ type: 'dropdown', id: 'device', label: 'Device', default: '', choices: deviceChoices }],
        callback: (event: CompanionFeedbackBooleanEvent<Types['feedbacks']['deviceMuted']['options']>) =>
          this.devices.get(String(event.options.device))?.mute === true,
      },
      destinationSource: {
        type: 'boolean', name: 'Destination source matches', defaultStyle: { bgcolor: combineRgb(0, 120, 180) },
        options: [
          { type: 'dropdown', id: 'device', label: 'Destination device', default: '', choices: deviceChoices },
          { type: 'number', id: 'channel', label: 'Destination RX channel', default: 1, min: 1, max: 128 },
          { type: 'textinput', id: 'sourceDevice', label: 'Expected source device', default: '' },
          { type: 'textinput', id: 'sourceChannel', label: 'Expected source channel', default: '' },
        ],
        callback: (event: CompanionFeedbackBooleanEvent<Types['feedbacks']['destinationSource']['options']>) => {
          const d = this.devices.get(String(event.options.device))
          const ch = d?.rxChannels.find((c) => c.id === Number(event.options.channel))
          return !!ch && ch.sourceDevice === String(event.options.sourceDevice) && ch.sourceChannel === String(event.options.sourceChannel)
        },
      },
      destinationStatus: {
        type: 'boolean', name: 'Destination status matches', defaultStyle: { bgcolor: combineRgb(0, 120, 180) },
        options: [
          { type: 'dropdown', id: 'device', label: 'Destination device', default: '', choices: deviceChoices },
          { type: 'number', id: 'channel', label: 'Destination RX channel', default: 1, min: 1, max: 128 },
          { type: 'textinput', id: 'status', label: 'Expected status', default: 'STATIC' },
        ],
        callback: (event: CompanionFeedbackBooleanEvent<Types['feedbacks']['destinationStatus']['options']>) => {
          const d = this.devices.get(String(event.options.device))
          const ch = d?.rxChannels.find((c) => c.id === Number(event.options.channel))
          return !!ch && ch.status === String(event.options.status)
        },
      },
    }
    return feedbacks
  }

  private buildVariables(): CompanionVariableDefinitions<Types['variables']> {
    const vars: Record<string, { name: string }> = {
      controller_connected: { name: 'Turtle controller connected' },
      dante_device_count: { name: 'Dante device count' },
      dante_online_device_count: { name: 'Dante online device count' },
    }
    for (const d of this.devices.values()) {
      const key = d.id.toLowerCase()
      vars[`device_${key}_name`] = { name: `${d.name} name` }
      vars[`device_${key}_online`] = { name: `${d.name} online` }
      vars[`device_${key}_ip`] = { name: `${d.name} IP` }
      vars[`device_${key}_clock_source`] = { name: `${d.name} clock source` }
      vars[`device_${key}_clock_status`] = { name: `${d.name} clock status` }
      vars[`device_${key}_sample_rate`] = { name: `${d.name} sample rate` }
      vars[`device_${key}_encoding`] = { name: `${d.name} encoding` }
      vars[`device_${key}_latency_us`] = { name: `${d.name} RX latency (us)` }
      vars[`device_${key}_mute`] = { name: `${d.name} mute` }
      for (const ch of d.rxChannels) {
        vars[`device_${key}_rx_${ch.id}_source_device`] = { name: `${d.name} ${ch.name} source device` }
        vars[`device_${key}_rx_${ch.id}_source_channel`] = { name: `${d.name} ${ch.name} source channel` }
        vars[`device_${key}_rx_${ch.id}_status`] = { name: `${d.name} ${ch.name} status` }
      }
    }
    return vars as CompanionVariableDefinitions<Types['variables']>
  }

  private updateVariables(): void {
    const values: Record<string, string | number | boolean | undefined> = {
      controller_connected: this.controllerOnline,
      dante_device_count: this.devices.size,
      dante_online_device_count: this.onlineCount(),
    }
    for (const d of this.devices.values()) {
      const key = d.id.toLowerCase()
      values[`device_${key}_name`] = d.name
      values[`device_${key}_online`] = d.online
      values[`device_${key}_ip`] = d.ip
      values[`device_${key}_clock_source`] = d.clockSource
      values[`device_${key}_clock_status`] = d.clockStatus
      values[`device_${key}_sample_rate`] = d.sampleRate
      values[`device_${key}_encoding`] = d.encoding
      values[`device_${key}_latency_us`] = d.rxLatency
      values[`device_${key}_mute`] = d.mute
      for (const ch of d.rxChannels) {
        values[`device_${key}_rx_${ch.id}_source_device`] = ch.sourceDevice
        values[`device_${key}_rx_${ch.id}_source_channel`] = ch.sourceChannel
        values[`device_${key}_rx_${ch.id}_status`] = ch.status
      }
    }
    this.setVariableValues(values as Partial<Types['variables']>)
  }

  private buildPresets(): CompanionPresetDefinitions<Types> {
    return {}
  }

  public getConfigFields(): SomeCompanionConfigField[] {
    return [
      { type: 'textinput', id: 'host', label: 'Controller IP / hostname', width: 6, default: '' },
      { type: 'dropdown', id: 'protocol', label: 'Protocol', width: 3, default: 'http', choices: [
        { id: 'http', label: 'HTTP' },
        { id: 'https', label: 'HTTPS' },
      ] },
      { type: 'checkbox', id: 'verifyTls', label: 'Verify HTTPS certificate', width: 3, default: false },
      { type: 'number', id: 'pollInterval', label: 'Dante poll interval (ms)', width: 6, default: 2000, min: 1000, max: 60000 },
      { type: 'number', id: 'timeout', label: 'HTTP timeout (ms)', width: 6, default: 2500, min: 250, max: 30000 },
    ]
  }
}
