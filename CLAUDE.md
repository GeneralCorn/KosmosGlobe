# CLAUDE.md — kosmosglobe

This is a take-home assignment. Time budget is hours, not days. Read this whole file before doing anything else, and re-read the relevant section before starting each new task. The constraints in this document override any general best-practice instinct you may have.

## What we're building

A native iOS app that visualizes the Kosmos OSINT API as a 3D globe. The grading axes, in order: **performance on mobile** , **interface quality** , **speed of build** , and **how far we take it** . We are showing information signals from the API and pushing the visualization as far as time allows.

This is NOT a generic 3D globe. We are explicitly avoiding the cliché look:

- No hexagonal H3 tiles with extruded prisms
- No photo-textured Blue Marble Earth
- No bloom postprocessing
- No cyan-on-navy color scheme
- No identical parabolic arcs everywhere
- No starfield background

We ARE building:

- A dark, vector-rendered Earth with country borders drawn from GeoJSON
- Country surfaces tinted by `heat_score` (gradient, not buckets)
- Orbital markers floating slightly above the surface, color-coded by `category`
- A small information dashboard with real numbers from the API
- One coherent color system: 4 marker colors, one per category, plus background/text neutrals

## Hard rules (non-negotiable)

These produce 60fps on iOS. Violating any one of them is a regression even if the result "looks fine":

1. **The 3D scene tree mounts ONCE.** `<Canvas>` and everything inside it gets mounted on app start with empty data, and never re-renders. All updates flow through refs and `useFrame`. Never write `<Markers events={events} />` where `events` changes — write `<Markers />` (no props) that reads from the Zustand store inside `useFrame`.
2. **One InstancedMesh per visual concept.** All markers are ONE InstancedMesh with N instances. Never `events.map(e => <Marker />)`. Same rule for arcs (single merged BufferGeometry), pulse rings, country fills if instanced.
3. **`useFrame` allocates nothing.** No `new Vector3()`, no `new Matrix4()`, no array literals, no object literals. Allocate temp objects ONCE outside `useFrame`, mutate inside. GC pauses on mobile are visible as frame drops.
4. **Gestures write to refs/shared values, never to React state.** `react-native-gesture-handler` updates a Reanimated shared value or a `useRef`. A `useFrame` reads it and applies to the camera. Camera transform is NEVER a React prop.
5. **Sphere geometry: 64 segments. No more.** 32,768 triangles in a 128-segment sphere is wasted on a phone screen.
6. **Cap rendered events at 50.** If the API returns 500, render the most recent or most relevant 50. Visual density past ~50 is negative.
7. **No shadows. No postprocessing. No env maps. No antialias on lower-tier devices.**
8. **The store has a version number.** When data changes, version increments. `useFrame` reads version each frame; only re-syncs InstancedMesh matrices when version changes. Most frames just animate, don't iterate the full event list.

## Architecture

Three rings with strict import boundaries:

```
Ring 3 (UI, Data) — domain/, api/, ui/
  ↓ Never imports from `three` or `@react-three/*`
  ↓ Speaks only in domain types

Ring 2 (Scene composition) — scene/
  ↓ Imports r3f primitives only
  ↓ Knows nothing about shaders or geometry internals

Ring 1 (Rendering primitives) — layers/
  Imports three, GLSL, expo-three
  Each layer is a self-contained component
```

**Boundary rules:**

- Nothing in `domain/`, `api/`, or `ui/` may `import` from `three`, `@react-three/*`, or files inside `scene/` or `layers/` (except types).
- `latLngToVector3` lives in `layers/`, NOT in `domain/`. Lat/lng → 3D conversion is engine-specific; the domain just has `{lat, lng}`.
- Each layer in `layers/` exposes a clean prop surface (or no props, reading from store). To swap a layer's implementation, you should only have to rewrite that one folder.
- The store exposes selectors (`useVisibleEvents()`, `useSelectedEvent()`), not raw arrays.

## File structure

```
src/
  domain/
    types.ts            ← NewsEvent, LatLng, etc. NO three imports.
    store.ts            ← Zustand. Version number. NO three imports.
    encodings.ts        ← Pure functions: API field → visual property. NO three imports.
  api/
    client.ts           ← fetch wrapper. ONE place to add auth header later.
    queries.ts          ← react-query hooks. Returns domain types.
    fixtures/
      explorer.json     ← saved /explorer/overview response
      signals-top.json  ← saved /signals?sort=top response
      globe.json        ← saved /globe/activity response
  scene/
    Canvas.tsx          ← <Canvas> wrapper. Mounted once.
    SceneRoot.tsx       ← composes layers
    CameraRig.tsx       ← reads selection, lerps camera
    GestureLayer.tsx    ← gesture-handler → shared values
  layers/
    earth/
      Earth.tsx         ← extruded country plates from GeoJSON
      countries.geojson ← Natural Earth 50m
      latlng.ts         ← lat/lng ↔ Vector3 helpers (engine-side)
      earth.frag.glsl   ← surface shader, heat tint
      earth.vert.glsl
    atmosphere/
      Atmosphere.tsx    ← fresnel rim glow
      atmosphere.frag.glsl
      atmosphere.vert.glsl
    markers/
      Markers.tsx       ← ONE InstancedMesh, orbital signal markers
    arcs/
      Arcs.tsx          ← optional, merged BufferGeometry
    pulses/
      Pulses.tsx        ← optional, pulse rings on the surface
  ui/
    Dashboard.tsx       ← collapsed badge, expands to full panel
    BottomSheet.tsx     ← signal detail on tap
    StatsOverlay.tsx
    SourceMix.tsx
    VelocityList.tsx
    LiveTicker.tsx
    FilterRail.tsx
  lib/
    countryCentroids.ts ← ISO code → {lat, lng}, ~250 entries
    geo.ts              ← haversine, angular distance, etc.
```

## The API (Kosmos)

Base URL: `https://api.kosmos.fyi`. Read-only, no auth required for our endpoints. Always use the `apiClient` wrapper — it's the single point where a Bearer header would be added if needed later.

**Primary fetches** (poll every 60s with react-query, respecting `s-maxage=30, stale-while-revalidate=60`):

- `GET /api/v2/globe/activity?limit=50` — country heat scores, drives surface tint
- `GET /api/v2/signals?sort=top&limit=50` — individual signals, drives markers
- `GET /api/v2/explorer/overview` — dashboard stats

**On-demand fetches** (lazy, on user interaction):

- `GET /api/v2/signals/{id}` — when a marker is tapped, full signal detail
- `GET /api/v2/globe/region/{country}` — when a country is tapped (stretch goal)
- `GET /api/v2/signals/facets` — for the filter rail's category counts

**Critical:** Save the first response from each primary endpoint into `src/api/fixtures/`. Develop against fixtures by default. Only hit the live API when explicitly testing live data flow. This is faster, deterministic, and lets us demo offline.

## Data shape (as we'll use it)

The API returns ISO country codes, not coordinates. We map ISO → centroid via `lib/countryCentroids.ts`, then add a deterministic small jitter (hash of signal ID → small offset) so multiple signals in one country don't stack at exactly the same point.

```ts
// domain/types.ts
export type Category = "geopolitics" | "economics" | "health" | "other";

export type NewsEvent = {
  id: string; // signal.id
  title: string;
  summary: string;
  countryCode: string; // ISO-3166-1 alpha-2
  position: { lat: number; lng: number }; // from centroid + jitter
  category: Category; // mapped from signal.category
  severity: number; // 0-1
  momentum: number; // 0-1
  freshnessHours: number;
  evidenceCount: number;
  xVolumeDelta: number; // signal.x_volume.delta_pct
  primaryMarketId: string | null;
  raw: SignalCard; // full original payload for the bottom sheet
};

export type CountryHeat = {
  code: string; // ISO alpha-2
  heatScore: number; // 0-1 normalized
};
```

## Visual encoding contract

`domain/encodings.ts` holds the rules that map API fields to visual properties. Pure functions, no three imports. ALL visual encoding logic lives here:

```ts
// Tower/marker height contribution from cluster density
export function clusterBoost(target: NewsEvent, all: NewsEvent[]): number;

// Marker size in world units
export function markerSize(event: NewsEvent, boost: number): number;

// Marker base color in normalized RGB
export function markerColor(event: NewsEvent): [number, number, number];

// Emission intensity (recent = bright)
export function markerEmission(event: NewsEvent): number;

// Whether to render a pulse ring
export function shouldPulse(event: NewsEvent): boolean;

// Country surface tint alpha (0-1)
export function countryTint(heat: CountryHeat): number;
```

If you want to change the war-color rule from "category=geopolitics" to "severity>0.8 AND momentum>0.5," it's one function. The rendering code never has to know.

## Aesthetic spec (lock these, don't drift)

**Color palette** (hex, all locked):

- Background: `#06080F`
- Earth surface: `#0A0E1A`
- Country borders: `#FFFFFF` at 18% alpha
- Heat tint gradient: `#5A2418` (dim) → `#E8975D` (hot)
- Marker — geopolitics/conflict: `#FF6B4A` (warm red)
- Marker — economics: `#5BA8FF` (cool blue)
- Marker — health/climate: `#7FE0A8` (muted green)
- Marker — other: `#B89BE8` (pale purple)
- Text primary: `#E6EDF3`
- Text secondary: `#7D8590`
- Active accent: `#FFFFFF`

NO yellow. NO cyan-as-default. NO additional reds-of-different-saturation for "severity tiers." Severity is encoded by SIZE and BRIGHTNESS, not by hue. Do not invent new colors.

**Typography:**

- Mono font (JetBrains Mono): all data, labels, timestamps, country codes, section headers
- Sans font (Inter): headlines and body text in the bottom sheet
- Two fonts. That's it.
- Section headers use small caps with letter-spacing (e.g., "ACTIVE SIGNALS")

**Globe rendering:**

- Vector-rendered, NOT photo-textured
- Country shapes from `ne_50m_admin_0_countries.geojson`
- Each country triangulated with `earcut`, rendered as a slightly extruded plate (height ~0.005 of sphere radius)
- Border lines drawn as `LineSegments` on top of the country fills
- The slight extrusion is what gives the globe physical depth — not a heightmap
- Atmosphere fresnel sphere just outside the main sphere, transparent, cool tint

**Markers (orbital):**

- Position: country centroid + signal-id-derived jitter, then offset along the surface normal by 5-8% of sphere radius (markers float ABOVE the surface, not on it)
- Geometry: small sphere or billboard, NOT a tower/cylinder/spike
- Color binds to category (4 colors, hard-locked above)
- Size binds to severity × cluster boost (clamped)
- Emission binds to freshness (recent = bright)
- The most recent single marker pulses (radius animates, slow)

**Animation:**

- Slow auto-rotation when idle, paused on touch, resumed after 5s of no interaction
- Camera lerps to selected marker via quaternion slerp (NOT euler interpolation — gimbal issues at poles)
- New markers fade in over ~600ms, no overshoot/spring
- Hover states (when applicable) lerp at 0.15 per frame

**UI surfaces:**

- No backdrop blur (perf cost, can't be done well at 60fps on most phones)
- No gradients on UI panels — solid color with low opacity
- Pills are outlined, not filled
- Generous whitespace; the dashboard takes the right edge but leaves the globe room to breathe

## Dashboard layout

Default state: collapsed corner badge, monospace, one line:

```
●  142 signals · 87 countries · 9.3K evidence/24h
```

Expanded state (tap badge): right-edge panel with these sections, in this order:

1. **Stats / 24h** — from `/explorer/overview`. active signals, evidence, countries, markets active.
2. **Source mix** — from `/signals/facets`. Bar chart of `evidence_type` proportions.
3. **Accelerating ↑** — from `/signals?sort=velocity&limit=5`. Top 5 by `x_volume.delta_pct`.
4. **Live feed** — scrolling list of recent evidence items derived from current signals' `top_evidence`.
5. **Filter rail** — from `/signals/facets.categories`. Click to filter the globe.

When the dashboard is collapsed, only the badge is visible. When expanded, the badge becomes the panel header.

## Bottom sheet (signal detail)

Tap a marker → bottom sheet slides up via `@gorhom/bottom-sheet`. Contents:

- Title (large, sans)
- Category, country code, freshness (mono, small caps)
- Severity bar (single line, no number, just a bar)
- Evidence count + source breakdown (e.g., "47 sources: 32 news, 15 tweets")
- Top 3 evidence items as plain rows: source name, headline, time, URL link out
- Linked market (if `primary_market` exists): market title and current price as a chip

NO embedded tweets. NO embedded news cards. Plain text + source attribution. This sidesteps the AI-slop look entirely and reads as analyst tool.

## Build phases (suggested order)

Track progress via PLAN.md (separate file). Each phase ends with a checkpoint commit.

**Phase 0 — Scaffold + verify** (~30 min)

- `npx create-expo-app` with TypeScript template
- Add `expo-dev-client`, `expo-gl`, `expo-three`, `three`, `@react-three/fiber`, `react-native-gesture-handler`, `react-native-reanimated`, `@tanstack/react-query`, `zustand`, `@gorhom/bottom-sheet`, `earcut`
- `npx expo prebuild` for iOS
- `npx expo run:ios` — verify it builds and runs in simulator
- Render a single colored sphere with `useFrame` rotation — proves the GL pipeline

**Phase 1 — Data layer** (~30 min)

- Domain types in `domain/types.ts`
- `apiClient` wrapper in `api/client.ts` with single-point auth hook
- Save fixtures from live API to `api/fixtures/`
- react-query hooks in `api/queries.ts`
- Zustand store in `domain/store.ts` with version number, selectors
- Country centroid lookup in `lib/countryCentroids.ts`
- Visual encodings in `domain/encodings.ts`
- `lat/lng → Vector3` helper in `layers/earth/latlng.ts`
- Verify: log raw signals to console, confirm fixtures load, no three imports outside `layers/` and `scene/`

**Phase 2 — Globe base** (~60 min)

- Load GeoJSON, triangulate country polygons with `earcut`
- Build extruded country plates as a single merged BufferGeometry (or per-country if needed for hover)
- Border lines as a separate `LineSegments`
- Custom shader for country fill with heat-tint uniform
- Atmosphere fresnel sphere
- Auto-rotation in `useFrame`
- Verify: globe renders, looks like our aesthetic spec, runs at 60fps in simulator

**Phase 3 — Markers** (~45 min)

- ONE InstancedMesh of orbital marker spheres (or billboards)
- Sync from store via `useFrame` + version number
- Position from country centroid + jitter + orbital offset
- Per-instance color (from category) via instance attribute
- Per-instance scale (from severity + cluster boost)
- Verify: markers appear at correct countries, colored correctly, no per-frame allocations

**Phase 4 — Interaction** (~45 min)

- Gesture controls: pan-to-rotate, pinch-to-zoom (write to shared values)
- Tap detection: raycast from screen position to InstancedMesh
- Tapped marker → store.selectedId → camera lerps via CameraRig
- Bottom sheet appears with signal detail
- Idle rotation pauses on touch, resumes after 5s

**Phase 5 — Dashboard** (~45 min)

- Collapsed badge state (single line, monospace)
- Expanded panel with all 5 sections
- Filter rail wires to store, applies predicate to `useVisibleEvents()` selector
- Live ticker derived from cached signals data

**Phase 6 — Polish** (~30 min)

- Cluster-boost on marker sizes (your "skyline density" effect, but on orbital markers)
- Country surface heat tint from `/globe/activity`
- Pulse on most-recent marker
- Optional: arcs between same-category recent signals (single merged BufferGeometry)

**Phase 7 — Stretch** (only if time)

- Linked market chip in bottom sheet
- "Ground view" toggle: thin lines drop from each marker down to the country surface
- Sort-mode toggle (top / recent / velocity)
- Country deep-dive panel via `/globe/region/{country}`

**Phase 8 — Ship** (last 15 min — sacred, do not skip)

- README with: setup steps (`npm install`, `npx expo prebuild`, `npx expo run:ios`), brief design decisions section
- Screen recording from iOS simulator (`xcrun simctl io booted recordVideo demo.mov`)
- Final commit, push to GitHub

## Cut order if perf is bad

If FPS drops below 50, cut in this order:

1. Arcs first
2. Pulse rings second
3. Drop sphere segments to 32
4. Cut event count cap from 50 to 25
5. Drop country extrusion (flat fills instead)
6. Drop atmosphere fresnel (last resort — this is what makes it look good)

## FPS counter

Add a tiny FPS readout in dev mode. Compute frame time in `useFrame`, display in a corner with `Text` from r3f or just a regular RN component bound to a ref-driven value. When you add a feature, you immediately see its cost. Don't wait until hour 3 to discover what's expensive.

## Things you (Claude Code) will be tempted to do that you should NOT

- Render markers as `events.map(e => <Marker />)`. Use InstancedMesh.
- Pass `events` as a prop to a 3D component that re-renders. Read from store via `useFrame`.
- Use `useState` to drive animations. Use refs + `useFrame`.
- Add a photo-realistic Earth texture "for fallback." We don't have one. We don't want one.
- Add bloom postprocessing because it "looks cinematic." It tanks mobile perf.
- Add new colors not in the palette. The palette is locked.
- Add starfield particles in the background. Solid color. Restraint.
- Use `OrbitControls` from drei. Doesn't work on native. Roll our own with gesture-handler.
- Use `<Suspense>` for the globe data. Suspense + react-query + 3D scene composition is a footgun. Keep loading states explicit.
- Embed tweets or news cards as iframes/widgets. Plain text rows only.
- Make towers/spikes for v1. We chose orbital markers. Towers are a v2 stretch.
- Compute haversine distance with Euclidean math on 3D vectors going through the sphere. Use angular distance (dot product → acos).
- Re-render the entire scene tree when new data arrives. The scene mounts once.
- Pull in libraries beyond what's listed. If you think we need one, ask first.

## Things to do whenever you're unsure

- Re-read this file's relevant section.
- If a perf rule conflicts with a feature, the perf rule wins.
- If unsure between two implementations, pick the one with fewer draw calls.
- If a feature isn't in the build phases above, it's stretch. Get the core working first.
- If you're about to implement something visual, check the aesthetic spec before writing any color or font.
