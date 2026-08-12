# Bitfocus Companion - Turtle Dante Controller

Early-stage Companion connection module for Turtle Dante controller web interfaces.

## Current functionality

- Connect to the Turtle controller over HTTP or HTTPS.
- Optionally accept self-signed/invalid HTTPS certificates.
- Poll `getjson.cgi?json=dante` for Dante inventory.
- Identify devices by MAC address rather than device name.
- Preserve discovered devices in a runtime cache when they disappear from the Turtle API and mark them `OFFLINE`.
- Discover RX and TX channels independently, including stereo/multichannel devices.
- Expose device information as Companion variables.
- Expose clock source and clock synchronization status.
- Expose RX latency information in microseconds.
- Expose device mute status when supplied by the Dante API.
- Provide device online/offline, clock, mute, route/source, and destination-status feedbacks.
- Provide a refresh action.
- Provide the known Dante routing SET command:
  `SET DANTE DEV <destination> AUDIO RXCHN <rx-channel> SOURCE <source> CHN <source-channel>`.

## Important API limitations

The supplied Turtle API information currently gives us a reliable read/monitoring interface and one known routing SET command. The module intentionally does **not** invent commands for functions that have not been verified.

### Planned if commands can be discovered

- Clear/unroute a Dante RX channel.
- Device/channel mute control.
- Output level control.
- RX latency control.
- Clock source/control.
- Additional Dante device configuration.
- Persistent cache storage across Companion restarts.

The module architecture keeps these possibilities open, but they are deliberately not exposed as fake actions until the Turtle command syntax is confirmed.

## Offline-device behavior

A device is keyed internally by normalized primary MAC address. If the device is absent from a later `dante` response, its cached record remains and its status becomes `OFFLINE`. If the device returns, its current name and other information replace the cached values while retaining the MAC-based identity.

This is important because changing a Dante device name should not break Companion button configurations.

## HTTPS

The Turtle controller may use a self-signed or otherwise non-public certificate. HTTPS is supported with certificate verification disabled by default. Certificate verification can be enabled if the controller has a trusted certificate.

## Known caveat in this first build

Companion's dynamic option definitions are refreshed after discovery. The initial implementation focuses on getting the inventory/state model correct. The route action currently uses discovered device choices, while channel dropdown population will be refined as the module is tested against Companion's current dynamic-option behavior.

## API endpoints currently used

- `/cgi-bin/getjson.cgi?json=dante`
- `/cgi-bin/getjson.cgi?json=mxsta` (reserved for future controller information)
- `/cgi-bin/getjson.cgi?json=time` (reserved for future controller time information)
- `/cgi-bin/submit?cmd=...`

## Development

Requires Node.js 22.20.x and a current Companion module development environment.

```bash
yarn install
yarn build
yarn dev
yarn check
yarn package
```

Use `yarn dev` while the module sits inside Companion's configured developer-modules folder. Companion will detect rebuilt files and restart the module automatically.

The packaged module is produced by the Companion module tooling.
