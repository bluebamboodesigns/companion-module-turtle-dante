# Bitfocus Companion - Turtle Dante Controller

Bitfocus Companion connection module for Turtle Dante controller web interfaces.

## Current functionality

- Connect to the Turtle controller over HTTP or HTTPS.
- Optionally accept self-signed/invalid HTTPS certificates.
- Poll `getjson.cgi?json=dante` for Dante inventory.
- Identify devices by MAC address rather than device name.
- Preserve discovered devices in a persistent cache when they disappear from the Turtle API and mark them `OFFLINE`.
- Discover RX and TX channels independently, including stereo/multichannel devices.
- Expose device information as Companion variables.
- Expose clock source and clock synchronization status.
- Expose RX latency information in microseconds.
- Expose device mute status when supplied by the Dante API.
- Provide grouped device-state feedbacks for online status, clock status, and mute status.
- Provide route-aware feedbacks for destination RX source match and destination RX status match using discovered channel references.
- Provide a refresh action.
- Provide Companion presets for refresh and per-device status buttons with image icons.
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
The module architecture keeps these possibilities open, but they are deliberately not exposed as fake actions until the Turtle command syntax is confirmed.

## Offline-device behavior

A device is keyed internally by normalized primary MAC address. If the device is absent from a later `dante` response, its cached record remains and its status becomes `OFFLINE`. If the device returns, its current name and other information replace the cached values while retaining the MAC-based identity.

This is important because changing a Dante device name should not break Companion button configurations.

The cache is persisted to `turtle-dante-cache.json` in the module root, so offline devices and discovered channel relationships survive a Companion restart.

## HTTPS

The Turtle controller may use a self-signed or otherwise non-public certificate. HTTPS is supported with certificate verification disabled by default. Certificate verification can be enabled if the controller has a trusted certificate.

## Feedbacks

The module exposes five feedbacks:

- `Dante device online status`
- `Dante device clock status`
- `Dante device mute status`
- `Destination RX source matches`
- `Destination RX status matches`

The route-aware feedbacks use the same discovered TX/RX channel references as the route action. Stored selections are based on stable device identity plus channel number, so renaming a Dante device or channel does not break the feedback configuration.

`Destination RX status matches` compares the selected RX channel's current `status` value from the Turtle API to the expected status string chosen in the feedback.

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
