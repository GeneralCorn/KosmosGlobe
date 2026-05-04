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
