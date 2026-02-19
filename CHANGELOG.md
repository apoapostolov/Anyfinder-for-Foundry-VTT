# Changelog

All notable changes to this project are documented in this file.

## [13.0.0] - 2026-02-19

### Added

- Initial standalone public release of Anyfinder.
- System-agnostic token pathfinding wrapper for Foundry VTT v13.
- Token Controls pathfinding toggle.
- Optional world fog-exploration restriction for route planning.
- Wall lifecycle synchronization (create/update/delete).
- Safe fallback behavior to native movement pathing.
- Gridless pathfinding with token-size-aware wall clearance.
- Configurable gridless graph sampling (`gridlessNodeStepPx`) and optional
  squeeze/leeway controls.
- Global force setting to enable pathfinding for all players by default.

### Improved

- Curved-wall routing reliability is significantly improved, including dense and
  irregular wall chains.
- Invalid diagonal corner-cutting near curved wall pinch points is prevented.
- Drag responsiveness is significantly improved in dense wall scenes.
- Long gridless routes on large scenes now degrade step size automatically when
  scene node budgets are exceeded, instead of failing immediately.
- Adaptive A* iteration cap for gridless routing to reduce early stop behavior
  on long, curvy routes.
- Reduced hard-corner sticking with targeted corner-guard handling.
- Gridless drag pathing is now significantly more stable during long/complex
  drags by using staged retry tiers, blocked-endpoint projection, and
  short-window reuse of last valid paths instead of dropping immediately.
- Added `Gridless Minimum Center Clearance (px)` so squeeze leeway cannot
  collapse effective collision below a safe floor in dense wall clusters.
- Final route validation around walls is more consistent and avoids false-safe
  line choices in tight corridors.
- Route recomputation during active drag is more stable with fewer visible
  path drops.

### Distribution

- Public repository bootstrap at:
  `https://github.com/apoapostolov/Anyfinder-for-Foundry-VTT`
- Manifest and download URLs wired for direct Foundry installation.
