# KosmosGlobe

A native iOS app that visualizes the [Kosmos OSINT API](https://api.kosmos.fyi) as a real-time 3D globe. Country surfaces tint by heat score, orbital markers float above signal origins colored by category, and a dashboard surfaces live stats, velocity leaders, and a scrolling evidence feed.

## Setup

```bash
npm install
npx expo prebuild --platform ios
npx expo run:ios
```

The app runs against local API fixtures by default (`src/api/fixtures/`). To switch to the live API, set `USE_LIVE_API=true` in your environment before starting Metro.

## Requirements

- Node 20+
- Xcode 16+ with iOS 17 simulator or physical iPhone 13+
- CocoaPods (`brew install cocoapods`)

## Architecture

Three concentric rings with strict import boundaries:

```
Ring 3  domain/, api/, ui/     — no three.js imports, domain types only
Ring 2  scene/                 — R3F composition, no shader or geometry internals
Ring 1  layers/                — three.js, GLSL, geometry builders
```

This boundary means the UI and data layer are completely decoupled from the rendering engine. Swapping a layer (e.g., replacing the marker geometry) requires touching one folder.

## Performance design decisions

**InstancedMesh for all markers.** Every signal renders as a single `InstancedMesh` with N instances rather than N individual meshes. This collapses all marker draw calls into one, which is the difference between 60fps and 20fps on a phone.

**Scene tree mounts once, data flows through refs.** The `<Canvas>` and everything inside it is constructed once on app start with empty data. When new signals arrive from react-query, the Zustand store increments a version number. `useFrame` reads the version each tick and only re-syncs instance matrices when it changes. Most frames skip the sync entirely and just animate.

**No allocations inside `useFrame`.** All `Vector3`, `Matrix4`, and `Quaternion` temporaries are allocated once outside the frame loop and mutated in place each frame. On mobile, GC pauses from per-frame allocations are visible as jitter.

**Gestures write to Reanimated shared values, not React state.** Pan and pinch deltas go directly into `useSharedValue` refs that `useFrame` reads. No React re-renders on gesture events.

**64-segment sphere.** A 128-segment sphere is 32,768 triangles for a shape that is a circle on screen. 64 segments are indistinguishable at phone resolution and cost half the vertex processing.

**50-event cap.** The API can return hundreds of signals. Past around 50 simultaneous markers, visual density becomes noise rather than information. The store trims to the 50 most recent before the scene ever sees the data.

## Visual system

The color palette is intentionally minimal and locked. Severity is encoded by marker size and emission brightness, not by hue, so the four category colors remain legible even under dense clusters.

| Role | Hex |
|---|---|
| Background | `#06080F` |
| Earth surface | `#0A0E1A` |
| Country borders | `#FFFFFF` at 18% alpha |
| Heat tint (dim → hot) | `#5A2418` → `#E8975D` |
| Geopolitics marker | `#FF6B4A` |
| Economics marker | `#5BA8FF` |
| Health / climate marker | `#7FE0A8` |
| Other marker | `#B89BE8` |

Typography uses two fonts only: JetBrains Mono for all data and labels, Inter for headlines and body text in the bottom sheet.

## Project structure

```
src/
  domain/       types, Zustand store, visual encoding rules
  api/          fetch client, react-query hooks, JSON fixtures
  scene/        Canvas, SceneRoot, CameraRig, GestureLayer
  layers/       earth, atmosphere, markers, arcs, pulses
  ui/           Dashboard, BottomSheet, FilterRail, LiveTicker
  lib/          country centroids, geo math
```
