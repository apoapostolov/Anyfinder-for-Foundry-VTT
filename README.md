# Anyfinder for Foundry VTT

[![Foundry v13](https://img.shields.io/badge/Foundry-v13-green)](https://foundryvtt.com/)
[![Module Version](https://img.shields.io/badge/version-13.0.0-blue)](./module.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Manifest](https://img.shields.io/badge/Manifest-module.json-orange)](https://raw.githubusercontent.com/apoapostolov/Anyfinder-for-Foundry-VTT/main/module.json)
[![Issues](https://img.shields.io/github/issues/apoapostolov/Anyfinder-for-Foundry-VTT)](https://github.com/apoapostolov/Anyfinder-for-Foundry-VTT/issues)

System-agnostic pathfinding for Foundry VTT v13.
Anyfinder routes token drag movement across shortest legal paths while
respecting walls and optional fog-of-war exploration limits.

## 13.0.0 Highlights

- Curved-wall routing no longer takes invalid diagonal corner-cuts on irregular
  wall chains.
- Gridless drag responsiveness is significantly improved on dense wall scenes by
  caching walk-graph traversability.
- Curved-wall handling is significantly more reliable on dense edge chains.
- Gridless collision checks now use near-wall sampled edge validation to reject
  false-safe segments before path acceptance.
- Corner-guard safety is enforced through final simplification and validation,
  reducing wall-edge clipping in tight curved corridors.
- Debug traces now make dense-edge fallback/collision failures easier to
  diagnose.

## What It Does

- Wraps token movement pathfinding through Foundry v13 APIs.
- Computes shortest legal routes instead of naive straight drag lines.
- Respects wall constraints and updates routing when walls change.
- Supports optional explored-fog-only movement restriction.
- Stays system-agnostic (not tied to PF2e, DnD5e, or any single ruleset).

## Features

- Token Controls toggle: `Pathfinding` (per-user).
- World setting: `Force Pathfinding For All Players` (default on).
- World setting: `Fog Exploration` restriction.
- Safe fallback to native pathing if wrapper/path backend is unavailable.
- Debug mode support for diagnostics.
- Gridless routing (experimental):
  - token-size and scale-aware wall clearance
  - configurable sampling step and squeeze/leeway behavior
  - large-map reliability fallback for node-budget pressure
- Canvas lifecycle integration:
  - initializes on `canvasReady`
  - tears down cleanly on `canvasTearDown`
  - syncs on wall create/update/delete

## Requirements

- Foundry Virtual Tabletop v13
- Required dependency:
  - [`lib-wrapper`](https://github.com/ruipin/fvtt-lib-wrapper)

## Installation

Use this manifest URL in Foundry (`Add-on Modules` -> `Install Module` ->
`Manifest URL`):

```txt
https://raw.githubusercontent.com/apoapostolov/Anyfinder-for-Foundry-VTT/main/module.json
```

Direct module archive URL:

```txt
https://github.com/apoapostolov/Anyfinder-for-Foundry-VTT/archive/refs/heads/main.zip
```

## Configuration

- `Pathfinding` tool toggle:
  - Per-user control in Scene Token Controls.
- `Force Pathfinding For All Players`:
  - World setting to globally force pathfinding on for all users.
- `Fog Exploration`:
  - World setting; when enabled route planning respects explored fog.
- `Debug Mode`:
  - World setting; logs Anyfinder internals to console.
- Gridless tuning:
  - `gridlessNodeStepPx`
  - `gridlessAllowSqueeze`
  - `gridlessSqueezeLeewayPx`

## Compatibility Notes

- Gridless support is functional but still performance-sensitive on very dense
  wall layouts.
- If `lib-wrapper` is missing or fails, Anyfinder falls back to native movement.

## Changelog

See [`CHANGELOG.md`](./CHANGELOG.md).

## License

MIT. See [`LICENSE`](./LICENSE).
