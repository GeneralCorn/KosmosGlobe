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
