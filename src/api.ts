import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import type { TurtleConfig, RawDanteResponse, RawMxstaResponse, RawTimeResponse } from './types.js'

export class TurtleApi {
  constructor(private readonly config: TurtleConfig) {}

  private baseUrl(path: string): URL {
    const rawHost = String(this.config.host ?? '').trim()
    if (!rawHost) throw new Error('Controller host is required')

    const candidate = rawHost.includes('://') ? new URL(rawHost) : new URL(`${this.config.protocol}://${rawHost}`)
    const protocol = candidate.protocol === 'https:' ? 'https:' : 'http:'
    const base = new URL(`${protocol}//${candidate.host}`)

    return new URL(path, base)
  }

  private async request(path: string): Promise<any> {
    const url = this.baseUrl(path)
    const isHttps = url.protocol === 'https:'
    const transport = isHttps ? https : http

    return await new Promise((resolve, reject) => {
      const req = transport.request(
        url,
        {
          method: 'GET',
          timeout: this.config.timeout,
          rejectUnauthorized: this.config.verifyTls,
          headers: { Accept: 'application/json', 'User-Agent': 'Bitfocus-Companion-Turtle-Dante/0.1.0' },
        },
        (res) => {
          let body = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => (body += chunk))
          res.on('end', () => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`HTTP ${res.statusCode ?? 'unknown'} from Turtle controller`))
              return
            }
            try {
              resolve(JSON.parse(body))
            } catch {
              reject(new Error(`Invalid JSON returned by Turtle controller for ${path}`))
            }
          })
        },
      )
      req.on('timeout', () => req.destroy(new Error(`Request timed out after ${this.config.timeout}ms`)))
      req.on('error', reject)
      req.end()
    })
  }

  async getDante(): Promise<RawDanteResponse> {
    return await this.request('/cgi-bin/getjson.cgi?json=dante')
  }

  async getMxsta(): Promise<RawMxstaResponse> {
    return await this.request('/cgi-bin/getjson.cgi?json=mxsta')
  }

  async getTime(): Promise<RawTimeResponse> {
    return await this.request('/cgi-bin/getjson.cgi?json=time')
  }

  async route(destinationDevice: string, destinationChannel: number, sourceDevice: string, sourceChannel: number): Promise<void> {
    const command = `SET DANTE DEV ${destinationDevice} AUDIO RXCHN ${destinationChannel} SOURCE ${sourceDevice} CHN ${sourceChannel}`
    await this.submit(command)
  }

  async submit(command: string): Promise<void> {
    const url = this.baseUrl('/cgi-bin/submit')
    url.searchParams.set('cmd', command)
    const isHttps = url.protocol === 'https:'
    const transport = isHttps ? https : http

    await new Promise<void>((resolve, reject) => {
      const req = transport.request(
        url,
        {
          method: 'GET',
          timeout: this.config.timeout,
          rejectUnauthorized: this.config.verifyTls,
          headers: { Accept: '*/*', 'User-Agent': 'Bitfocus-Companion-Turtle-Dante/0.1.0' },
        },
        (res) => {
          let body = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => (body += chunk))
          res.on('end', () => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`HTTP ${res.statusCode ?? 'unknown'} from Turtle submit endpoint`))
              return
            }
            resolve()
          })
        },
      )
      req.on('timeout', () => req.destroy(new Error(`Request timed out after ${this.config.timeout}ms`)))
      req.on('error', reject)
      req.end()
    })
  }
}
