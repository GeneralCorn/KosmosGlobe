# Project Log

Reverse-chronological record of milestones, pivots, and significant decisions for KosmosGlobe. Maintained for supervisor review.

## How to Use

Append new entries at the **top** of the "Entries" section. Each entry uses the template below.

### Entry Tags

- `MILESTONE` significant deliverable reached, e.g. first build, feature shipped, demo ready.
- `PIVOT` change of direction in scope, stack, or strategy.
- `DECISION` architectural or product choice worth preserving the reasoning for.
- `BLOCKER` external dependency or unresolved issue affecting timeline.
- `NOTE` general project context that does not fit the categories above.

### Template

```markdown
## YYYY-MM-DD [TAG] Short title

**Summary**
One or two sentences describing what happened.

**Context**
Why this happened, what triggered it, what was considered.

**Impact**
What changes downstream: scope, timeline, code, dependencies.

**Links**
- Commit: `<sha>` (optional)
- PR or issue: `#<n>` (optional)
- Related entries: `<date> <title>` (optional)
```

## Entries

## 2026-05-04 [NOTE] Phase 6 — Zoom-aware hierarchical clustering (Path B, planned)

> **Phase 6 — Zoom-aware hierarchical clustering (Path B).**
>
> Build a stable cluster tree once per data refresh, walk it per zoom change at runtime. Stable cluster identity (same physical cluster keeps same visual identity across zoom changes — no flicker / re-grouping artifacts during smooth zoom).
>
> **Algorithm — agglomerative bottom-up clustering, computed once per data version:**
> 1. Start with N leaf nodes, one per marker.
> 2. Compute pairwise great-circle (angular) distances between all leaves on the unit sphere. Use `acos(dot(a, b))` on normalized world positions, NOT screen-space distance — the tree must be view-independent so it stays stable as the user rotates the globe.
> 3. Repeatedly merge the closest pair into a parent node until one root remains. Each parent stores: weighted-centroid position (slerp on the sphere, weighted by child counts), aggregated count, dominant-category-by-count, max severity, max momentum, list of constituent signal IDs.
> 4. Each non-leaf node stores its merge distance (the angular distance between its two children) — this is the key threshold for runtime walking.
>
> **Runtime per zoom change (or rotation, since dot-product distance is rotation-invariant — only zoom changes the threshold):**
> 1. Compute the screen-space size threshold from current camera distance: roughly `mergeAngularThreshold = mergePixelThreshold / focalLengthInPixels`. Tunable constant. At default zoom, threshold ~3-5° angular distance; at full zoom-in, < 0.1°.
> 2. Walk the tree top-down. At each node, if its merge distance ≤ threshold → render the node as a cluster, stop descending. Else → recurse into children.
> 3. The set of "rendered nodes" at the current threshold is what gets pushed to the InstancedMesh. Each rendered node's instance index is determined by the node's stable ID (allocated once at tree-build time), so as the threshold changes, individual clusters smoothly grow/split rather than re-shuffling visually.
>
> **InstancedMesh sync:**
> - Capacity stays at 100 instances (existing Phase 3 cap covers worst case where all leaves are visible).
> - Per-frame: only re-sync when zoom changes meaningfully (track `lastThreshold`, only re-walk if `Math.abs(currentThreshold - lastThreshold) > epsilon`). Most frames are no-ops.
> - When walk produces fewer rendered nodes than last frame, zero-out the matrices of the now-unused instance slots (set scale to 0).
>
> **Cluster visual encoding:**
> - Position: cluster's stored slerp-centroid, projected to its orbital height (use the highest constituent's altitude so clusters don't sink below their hottest signal).
> - Size: `baseSize + log2(count + 1) * sizeScale` — log so a cluster of 16 isn't 16× a singleton.
> - Color: dominant category from the locked palette. If categories are tied, pick the one with highest aggregate severity.
> - No extra ring or badge in v1 — size alone reads as cluster. Reconsider in Phase 7 if needed.
>
> **Tap behavior (Phase 4 will need to know about this):**
> - Tap on a cluster → camera lerps to a position close enough that the cluster's merge threshold falls below the cluster's distance, splitting it. Compute target zoom from the cluster's stored merge distance.
> - Tap on a singleton → existing Phase 4 popup behavior.
>
> **Perf budget:**
> - Tree build: O(n²) but n ≤ 50, so ~1,250 distance pairs, runs once per ~60s data refresh. Submillisecond.
> - Runtime walk: O(log n) per visible node, ~50 visits worst case per zoom change. Submillisecond.
> - No per-frame allocations in the walk — preallocate the visited-node array once at tree build, reuse on each walk.
>
> **Files this will touch in Phase 6:**
> - New `src/domain/clustering.ts` — pure functions: `buildClusterTree(events)`, `walkTreeAtThreshold(tree, threshold) → renderedNodes[]`. No three imports — operates on `NewsEvent[]` and produces a tree of plain objects with stable IDs.
> - `src/layers/markers/Markers.tsx` — switch the sync source from `useVisibleEvents()` directly to `walkTreeAtThreshold(tree, currentThreshold)`. Tree is rebuilt when `useStoreVersion()` changes; threshold is tracked from camera distance via `useFrame`.
> - `src/scene/CameraRig.tsx` — exposes a current-zoom value (camera distance) for the threshold computation.
>
> **Fallback if perf becomes an issue (it won't, but documented for completeness):**
> Path A (greedy per-zoom-change clustering) is the fallback. Drop the tree, do greedy O(n²) screen-space distance grouping every time zoom changes meaningfully. Loses stable identity, gains simplicity. Don't switch unless you measure a real problem.

**Links**
- Related entries: `2026-05-04 [DECISION] Phase 3 readability tuning before clustering lands`

## 2026-05-04 [DECISION] Phase 3 readability tuning before clustering lands

**Summary**
On-device review showed the Middle East cluster collapsing into a single dot — same-country signals were stacking visually because (a) the ±0.5° lat/lng jitter from Phase 1 spread markers within ~55 km, well inside small countries like Israel/Lebanon, and (b) all markers shared one orbital altitude (1.06 sphere radius), so two markers at nearby lat/lng drew at nearly the same world point and Z-fought into one visible blob. Two fixes applied: jitter amplitude raised from ±0.5° to ±2.5° in `src/domain/mapping.ts:62`, and orbital altitude is now per-marker via `markerOrbitRadius(event)` in `src/domain/encodings.ts`, ranging 1.05 to 1.09 of sphere radius based on `severity * 0.025 + idHash * 0.015`.

**Context**
Real cluster aggregation is Phase 6 (see the planning note above). Phase 3 needs to be visually decoded *now* without zoom (Phase 4 dependency) and without aggregation. The two cheap fixes attack the two failure modes separately: (a) increased surface jitter spreads markers across country interiors instead of clustering at the centroid, (b) altitude variation pulls coplanar markers apart along the third axis. Severity weights heavier in the altitude formula (0.025 of 0.04 budget) so high-severity signals visibly float higher, reinforcing the size + brightness severity story. The id-hash component (0.015) breaks ties for equal-severity-same-country markers using the same FNV-1a hash already used for jitter, so altitude is deterministic across data refreshes — a marker doesn't visibly hop when the API returns the same signal twice. The Middle East stays dense but is now a readable 3D cloud rather than one dot.

**Impact**
Phase 4 raycasting will hit individual marker spheres rather than the worst-case "all 50 markers occupy one screen pixel" degenerate hit-test. Phase 6 clustering will absorb both the surface jitter and the altitude variation as inputs — leaves of the tree will already be spatially separated, so the agglomerative merge distances will be more meaningful. If markers feel overspread on device, drop jitter back to 1.5° or shrink the altitude budget; if still too tight, the Phase 6 clustering note above is the real solution and should be prioritized over further tuning.

**Links**
- Related entries: `2026-05-04 [NOTE] Phase 6 — Zoom-aware hierarchical clustering (Path B, planned)`, `2026-05-04 [DECISION] Marker geometry, scale, and orbital offset`, `2026-05-04 [DECISION] Jitter algorithm`

## 2026-05-04 [MILESTONE] Phase 3 complete — orbital markers wired to store

**Summary**
Single `InstancedMesh` of orbital signal markers, capacity 100, render cap 50, mounted inside the rotating earth group. Per-instance position from country centroid plus deterministic jitter, scaled by severity, colored by category, brightness modulated by freshness, with the most recent marker pulsing at 0.5 Hz. Sync is version-stamped: most frames only update one matrix (the pulse), full re-sync only on store version increment. Zero per-frame allocations confirmed by grep of the `useFrame` body.

**Context**
The component reads from the store via `useStore.getState()` rather than the `useStoreVersion()` selector hook; the hook variant would subscribe the component and trigger React re-renders on every increment, which violates the "scene tree mounts once" hard rule. All scratch objects (`tempVec`, `tempScale`, `tempMat`, `tempColor`, `IDENTITY_QUAT`) live at module scope and are mutated in place each frame. Filter narrowing (`cats && cats.length > 0`) keeps `events.filter` and the inline arrow off the hot path; that allocation only happens on version change, not per frame. `frustumCulled={false}` on the InstancedMesh prevents the engine from culling the entire mesh based on a bounding sphere that only describes a single instance at the origin.

**Impact**
Phase 4 can now raycast against `meshRef.current` to detect marker taps, then write the matched signal id to `state.selectedSignalId`. The bottom sheet will read `useSelectedEvent()` to render details. Per-instance colors arrive via `InstancedMesh.setColorAt`, which lazily allocates `instanceColor` on first call, so material reads `instanceColor` automatically without a `vertexColors` flag. Marker hit-test order is currently the same as `events` array order from the API (sorted by `rank_score` descending); Phase 4 raycasting will return the closest hit, not the first, so order won't matter for interaction.

**Links**
- Related entries: `2026-05-04 [DECISION] Marker geometry, scale, and orbital offset`, `2026-05-04 [MILESTONE] Phase 1 complete — data layer`

## 2026-05-04 [DECISION] Marker geometry, scale, and orbital offset

**Summary**
Markers use `SphereGeometry(1, 12, 12)` (288 triangles per instance, 50 instances → 14,400 triangles total at the marker layer, well under the earth's plate budget). Base size formula is `(0.012 + severity * 0.018) * clusterBoost`, with `clusterBoost` stubbed at 1.0; this puts a severity-zero marker at 1.2% of sphere radius and a severity-one marker at 3.0% of sphere radius. Orbital offset is 6% of sphere radius (mid-range of the brief's 5–8% spec). Pulse on the most recent marker oscillates ±10% of base scale at 0.5 Hz via `Math.sin(elapsedTime * 2π * 0.5)`. Phase 1's 0.5° jitter amplitude is retained — at this scale it produces about 55 km of in-country spread, visible as a tight cluster but not a stack.

**Context**
Sphere chosen over billboard because billboards on r3f-native need a custom shader to face the camera (drei's `<Billboard>` does not support InstancedMesh). A 12×12 sphere is cheaper than the standard 32×16 default and visually indistinguishable at the marker's size on a phone screen. Severity → size is multiplicative on a small base because additive ranges (`0.02 + severity * 0.05` from the Phase 1 stub) made high-severity markers visually dominate too aggressively at the chosen orbital offset; smaller base with multiplicative cluster boost reads as cleaner. Brightness multiplier on the per-instance color uses `EMISSION_FLOOR = 0.55`, so even 48-hour-old markers stay readable while sub-hour markers approach full saturation.

**Impact**
If markers feel too small on device, increase `severityScale` from 0.018 to 0.024. If the cluster on a hot country looks like a single dot, increase the Phase 1 jitter amplitude in `domain/mapping.ts` from 0.5° to 0.8°. If the pulse is distracting in long demo recordings, drop `PULSE_AMPLITUDE` from 0.10 to 0.05 or `PULSE_FREQ` from 0.5 to 0.3. None of these require touching the rendering pipeline.

**Links**
- Related entries: `2026-05-04 [MILESTONE] Phase 3 complete — orbital markers wired to store`, `2026-05-04 [DECISION] Jitter algorithm`

## 2026-05-04 [MILESTONE] Phase 1 complete — data layer

**Summary**
The data layer is end-to-end live. Domain types, fixture-backed API client with a live-mode env toggle, react-query hooks, Zustand store with version counter, country centroid lookup, signal-to-event mapper, encoding stubs, and the engine-side `latLng → Vector3` helper are all in place and verified against both saved fixtures and the live `https://api.kosmos.fyi` API.

**Context**
Verified by an on-mount log line that printed `eventsLoaded: 34, countriesWithHeat: 50, activeSignals: 115681` (fixture mode) then `activeSignals: 115765` (live mode, 84 new signals appeared between fixture capture and live test, proving the network path is real). Drop rate from raw signals to `NewsEvent` is 32% (50 → 34); the dropped signals are global signals with `country: null`, mostly from the `sports` category which the API treats as country-less. Boundary grep confirms zero `three` or `@react-three/*` imports outside `src/scene/` and `src/layers/`. TypeScript clean.

**Impact**
Phase 2 (globe base) can now consume real domain data: `useStore(s => s.events)` returns `NewsEvent[]` and `useStore(s => s.countryHeat)` returns `CountryHeat[]`, both kept in sync via `useSyncStoreFromQueries()` which is wired in `App.tsx`. The store's `version` increments on every events/heat/filter change; Phase 3's `useFrame` will read that to skip per-frame reconciliation. The fixture toggle (`EXPO_PUBLIC_USE_FIXTURES=false`) lets us demo offline by default while still being able to test against live data when needed.

**Links**
- Related entries: `2026-05-04 [DECISION] Category mapping table`, `2026-05-04 [DECISION] Jitter algorithm`, `2026-05-04 [MILESTONE] Phase 0 complete`

## 2026-05-04 [DECISION] Category mapping table

**Summary**
The Kosmos API surfaces the category strings `geopolitics`, `politics`, `sports`, `general`, `crypto`, `business` (in our top-50 fixture) plus an open set of others. CLAUDE.md locks our visual surface to four buckets: `geopolitics`, `economics`, `health`, `other`. The mapping table in `src/domain/mapping.ts` collapses the API surface into the four locked buckets; unmapped strings default to `other` with a `__DEV__`-guarded once-per-string `console.warn` so the table is observable as the API surface grows.

**Context**
The mapping is tied to the marker color palette, which is hard-locked to four colors per `CLAUDE.md`. We can't expand to more buckets without breaking the aesthetic spec, and we can't drop unmapped signals without losing observability. Defaulting to `other` plus a one-time warn per unknown string is the cheapest way to keep the visual surface stable while flagging when the table needs an update. The `seenUnknownCategories` Set deduplicates so a 50-signal payload with 18 sports doesn't spam 18 warnings.

**Impact**
- `politics` maps to `geopolitics` (same bucket, same color).
- `business`, `crypto`, `finance`, `markets`, `trade` map to `economics`.
- `health`, `climate`, `environment`, `disaster`, `pandemic`, `weather`, `medicine` map to `health` (none observed yet in fixtures).
- `sports`, `general` and any unmapped string fall to `other`. Observed at fixture capture: `sports` (18), `general` (7) both correctly bucketed.
- When the API surfaces a new category we haven't seen, dev console will warn once. Future-us updates the table in one place.

**Links**
- Related entries: `2026-05-04 [MILESTONE] Phase 1 complete`

## 2026-05-04 [DECISION] Jitter algorithm — FNV-1a, amplitude 0.5°

**Summary**
Multiple signals from the same country share a centroid and would stack at one point on the globe. The mapper applies a deterministic per-signal jitter, derived from a 32-bit FNV-1a hash of the signal ID, split into two halves for lat and lng offsets. Default amplitude is ±0.5° in each axis.

**Context**
Three properties matter: (1) deterministic — the same signal appears at the same offset on every load, otherwise markers would teleport between refreshes; (2) bounded — amplitude must be small enough that markers stay visually inside the country, not in a neighbor; (3) cheap — runs once per signal at mapping time, not per frame. FNV-1a is small, fast, has no dependencies, and gives a uniform-enough distribution for visual scatter. ±0.5° is roughly 55 km at the equator, smaller than any country except city-states. City-states (Singapore, Vatican, Monaco) will get the same offset every load and will not visibly cluster regardless because they only have one or two signals at most.

**Impact**
Jitter is encapsulated in `jitter(seed: string, amplitude = 0.5)` in `src/domain/mapping.ts`. If Phase 5 wants to scale amplitude with cluster density (more signals in one country → wider spread), the mapper can pass a per-signal amplitude derived from `clusterBoost`. No changes needed to consumers; the mapper output is just a `position: { lat, lng }` regardless.

**Links**
- Related entries: `2026-05-04 [MILESTONE] Phase 1 complete`

## 2026-05-04 [MILESTONE] Phase 0 complete — scaffold and rotating sphere at 60fps

**Summary**
The Expo + R3F + iOS pipeline is end-to-end live. A 64-segment sphere in `#5BA8FF` (locked palette economics-marker color) renders against the `#06080F` background on the iPhone 17 simulator, rotating on the Y axis via `useFrame`. The refs-driven FPS counter reads a steady `60.0 FPS` in the top right.

**Context**
Phase 0 per `CLAUDE.md` and the kickoff prompt: scaffold the project to the spec'd file structure, prove the GL pipeline, prove the perf instrumentation, and stop. Took one detour: see the related `BLOCKER` entry on the r3f-native + Fabric blank-canvas issue, resolved by an explicit `style={{ flex: 1 }}` on `<R3FCanvas>`. No other deviations from spec.

**Impact**
Phase 1 (data layer) can now build on a verified scene tree. The eight hard rules from `CLAUDE.md` are all enforceable starting from Phase 1 code: scene mounts once, no per-frame allocations, instanced meshes, refs-not-state for animation. The architecture-rings boundary is already enforced by directory layout (no `three` imports outside `layers/` or `scene/`).

**Links**
- Related entries: `2026-05-04 [BLOCKER] r3f-native blank canvas under Fabric`, `2026-05-04 [DECISION] Defer Reanimated 4 to Phase 4`

## 2026-05-04 [BLOCKER] r3f-native blank canvas under Fabric

**Summary**
First Phase 0 build deployed cleanly (0 errors, 0 warnings, 744 modules bundled) but the simulator screen showed only the dark background with no visible sphere. Diagnostic test (magenta root View, `meshNormalMaterial` sphere, frame counter) revealed `useFrame` was running at 60fps but the GLView was compositing nothing visible. Adding `style={{ flex: 1 }}` to the `<R3FCanvas>` resolved it.

**Context**
Tried disabling `newArchEnabled` first to test whether Fabric was the cause. That rebuild failed with a `consteval` clash in `fmt/format-inl.h` under Xcode 26's clang, an issue specific to the legacy bridge's React-Folly version. Re-enabled new arch and isolated the real fix in JS via Metro hot reload: the GLView under Fabric needs an explicit flex style to receive non-zero dimensions; without it, `useFrame` executes against a zero-sized canvas and nothing composites. The original code had no style on `<R3FCanvas>`, relying on r3f's web-style default sizing which does not apply identically under native Fabric.

**Impact**
Phase 0 ships with `newArchEnabled: true` (which Reanimated 4 requires in Phase 4), and the explicit canvas style is now part of the scene's mount contract. Future canvas-related changes must preserve `style={{ flex: 1 }}` (or explicit pixel dimensions) on the `<R3FCanvas>` element. Documented inline in `src/scene/Canvas.tsx` style block.

**Links**
- Related entries: `2026-05-04 [MILESTONE] Phase 0 complete`, `2026-05-04 [DECISION] Defer Reanimated 4 to Phase 4`

## 2026-05-04 [DECISION] Defer Reanimated 4 to Phase 4

**Summary**
Phase 0 ships without `react-native-reanimated` and without `@gorhom/bottom-sheet`. Both are reintroduced in Phase 4 when gestures and the bottom sheet are first wired in.

**Context**
The kickoff prompt instructed adding `react-native-reanimated/plugin` as the last entry in `babel.config.js`. That plugin path is correct for Reanimated v3. The current latest `react-native-reanimated@4.3.0` (which Expo SDK 54 and SDK 55 install) split worklets into a separate `react-native-worklets` package, and the Babel plugin moved to `react-native-worklets/plugin`. Following the kickoff verbatim against v4 produces a worklet runtime crash on first gesture. `@gorhom/bottom-sheet` depends on Reanimated, so it was deferred for the same reason. Phase 0's rotating sphere requires neither library, so the cleanest path was to skip them entirely now and add them, properly configured for v4, in Phase 4.

**Impact**
Phase 0 has no animation library overhead, which makes the first FPS reading a clean baseline for the GL pipeline alone. Phase 4 will install `react-native-reanimated@^4`, `react-native-worklets@^0.8`, and `@gorhom/bottom-sheet@^5`, then create `babel.config.js` with `react-native-worklets/plugin` as the last plugin, run `expo prebuild --clean`, and rebuild. No Phase 0 code changes will be required at that point; the gesture layer mounts inside the existing `<Canvas>` tree without re-rendering it.

**Links**
- Related entries: `2026-05-04 [MILESTONE] Repository initialized`

## 2026-05-04 [MILESTONE] Repository initialized

**Summary**
Cloned `GeneralCorn/KosmosGlobe` into the local trial workspace and added `CLAUDE.md` and `LOG.md` to support Claude Code workflows and supervisor-visible history.

**Context**
Repository was an Expo `.gitignore` template plus an empty README. Project scaffolding had not started. Setting up this log up front ensures every subsequent decision is captured from day one.

**Impact**
Future sessions in this directory will load `CLAUDE.md` automatically. All future milestones and pivots will be appended above this entry.

**Links**
- Commit: `fd18dc4` (last upstream commit at clone time)
- Related entries: none
