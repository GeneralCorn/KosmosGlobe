# REMAINING_PHASES.md

This is the canonical reference for Phases 2 through 8 of kosmosglobe. It is a planning document, not an execution prompt — Claude Code reads this for context at the start of each phase, but waits for an explicit per-phase kickoff prompt before starting work.

**Always read in conjunction with `CLAUDE.md`.** That file contains the architecture, performance rules, and aesthetic spec, and remains the source of truth on conflicts.

## Between-phase protocol

This protocol applies to every phase below.

1. **Wait for an explicit kickoff prompt** before starting a phase. Do not roll forward autonomously.
2. **At the end of each phase**: commit cleanly, update `LOG.md` with milestone/decisions/blockers, summarize the phase outcome briefly, and stop.
3. **Mid-phase, if you encounter:** a perf rule conflicting with a feature, an ambiguity in CLAUDE.md, a dependency version conflict requiring a non-obvious workaround, or any decision that locks in scope for later phases — stop and ask. Improvisation in scope = drift. Improvisation in dependency resolution = fine.
4. **If a phase takes longer than its rough budget**, pause and report. We may cut scope rather than overrun.
5. **After the phase**: do not preemptively start the next phase. Wait for human go.

`LOG.md` should accumulate entries that someone reviewing the project later can read top-to-bottom and understand what happened and why. The git log alone won't capture the *why*.

---

## Phase 2 — Globe base (visual foundation)

**Estimated:** 60-90 minutes. This is the hardest phase. Worth pausing mid-phase to check perf.

**Goal:** A dark vector-rendered Earth that runs at 60fps in the iOS simulator. Country shapes drawn from GeoJSON, slightly extruded so they read as 3D plates, with thin white borders. Atmosphere fresnel glow at the rim. Auto-rotation. No markers yet.

**In scope:**
- GeoJSON loading (Natural Earth `ne_50m_admin_0_countries.geojson`, ~500KB)
- Polygon triangulation with `earcut` — one merged BufferGeometry for all country fills, OR per-country meshes if needed for hover (decide based on perf measurement)
- Country plate extrusion: each country is a thin 3D plate, height ~0.005 of sphere radius, sitting just above the sphere surface
- Border lines drawn as `LineSegments` on top of the plates
- Custom shader on country fills with a `heatTint` uniform (vec4 — RGBA per country, indexed by country index)
- Atmosphere fresnel: a slightly larger transparent sphere with a fresnel shader for rim glow, cool tint matching aesthetic
- Auto-rotation in `useFrame`, ~0.05 rad/sec around Y axis. Mutate refs, don't use state.
- The Phase 0 placeholder sphere goes away — the real globe replaces it.

**Out of scope:**
- Markers (Phase 3)
- Heat tint actually wired to data — provide the uniform, but it can be a stub function returning all zeros for now (Phase 3/6 wires it up)
- Gestures (Phase 4)
- Country hover/tap (Phase 4)
- Borders animating, atmospheric scattering, postprocessing — none of it

**Decisions to make and log:**
1. **Single merged geometry vs. per-country meshes.** Single merged is faster (one draw call) but harder to highlight individual countries later. Per-country is N draw calls (where N ≈ 250) but trivial to color individually. Reasonable middle ground: single merged BufferGeometry with a per-vertex `countryIndex` attribute, then highlight via shader (look up tint by index in a uniform array). Pick one and log the reasoning.
2. **GeoJSON resolution.** 50m is the default (good detail, ~500KB). 110m is half the size but visibly chunky. 10m is ~5MB and overkill. If the 50m bundle hurts startup, fall back to 110m.
3. **Triangulation approach.** `earcut` works on flat 2D polygons. We need to handle: multi-polygons (many countries are), holes (rare but exist), and the lat/lng → 3D projection (do it after triangulation, on the resulting vertices). Document your approach.
4. **Antimeridian handling.** Some country polygons cross 180°/-180° (Russia, Fiji). Triangulating them naively creates triangles spanning the entire globe. Handle this: split polygons that cross the antimeridian, or use a polygon library that handles it. Alaska/Russia glitches are a common failure mode here.

**Definition of done:**
- App launches, dark globe visible, slowly rotating
- All ~250 countries render with visible borders
- No glitches at the antimeridian (confirm by rotating to view the Pacific)
- Atmosphere glow visible at the rim
- FPS counter steady at 60.0 in the simulator
- Phase 0 placeholder sphere is gone
- One commit, LOG.md updated

**Cut order if perf is bad mid-phase:**
1. Drop atmosphere fresnel (re-add in Phase 6)
2. Drop the country extrusion (use flat country fills on the sphere surface)
3. Switch from 50m to 110m GeoJSON
4. Reduce sphere segments to 32

---

## Phase 3 — Markers (orbital signal cloud)

**Estimated:** 45-60 minutes.

**Goal:** Render the signals from the Zustand store as orbital markers floating above the country surfaces. ONE InstancedMesh, syncs via `useFrame` + version number. No interaction yet — just the visual.

**In scope:**
- A single `InstancedMesh` of small spheres (or billboard sprites — pick based on perf measurement)
- Per-instance attributes: position, scale, color (RGB)
- `useFrame` reads `useStoreVersion()`. When changed, full re-sync of all instance matrices and color attribute. When unchanged, only animation updates (e.g., pulse on the most recent marker).
- Position calculation: country centroid (from `lib/countryCentroids`) → `Vector3` (via `layers/earth/latlng.ts`) → push outward along normal by 5-8% of sphere radius (this is the orbital offset that makes them float ABOVE the surface)
- Per-signal jitter applied: a deterministic small offset based on signal ID hash, so multiple signals in the same country don't stack at exactly one point
- Color per category from the locked palette
- Scale from `severity * clusterBoost` — wire up the encodings from Phase 1 even if `clusterBoost` is stubbed
- Emission/brightness varies with `freshnessHours` — recent = bright. Implement via per-instance color or via a separate per-instance emissive attribute, whichever is simpler.
- The most recent single marker pulses. Pulse animation runs in `useFrame` purely from time — no per-frame matrix recomputation for non-pulsing markers.
- All temp objects (Vector3, Matrix4, Quaternion) allocated ONCE outside `useFrame`, reused inside. Zero per-frame allocations.

**Out of scope:**
- Tap detection / raycast (Phase 4)
- Popups (Phase 4)
- Cluster boost based on real density math (Phase 6 — for now, return constant 1.0)
- Country surface heat tinting from data (Phase 6 — Phase 2 left a stub uniform)
- Arcs (Phase 6/7)

**Primary data source for markers:** Use `/globe/activity` countries (50 entries, each with centroid already attached) as the marker positions. The `/signals` endpoint is currently geographically skewed (US + IR dominate even at limit=200 due to current news cycle). Globe activity gives better geographic spread across 50 countries. Signals feed the detail panel when a marker is tapped.

**Data diversity note:** As of the build date, the API returns markers concentrated in North America, Iran, Western Europe, and a few East Asian countries. Africa, South America, and Southeast Asia are underrepresented in the current news cycle — not a code problem. If, at any point (live API call, different day, or after the API expands coverage), new countries appear in `/globe/activity` or `/signals`, they will automatically appear as markers with no code changes needed. The 50-instance cap in the InstancedMesh and the centroid-to-Vector3 path handle any country the API returns. Do NOT hardcode country lists or skip unknown countries — pass all API-returned entries through the pipeline and let the 50-cap trim if needed.

**Decisions to make and log:**
1. **Sphere vs. billboard for marker geometry.** Sphere = real 3D, looks good from all angles, more verts. Billboard = always camera-facing, fewer verts, can look weirdly flat at oblique angles. Pick based on visual feel and perf.
2. **Color encoding: per-instance attribute vs. per-category InstancedMesh.** One InstancedMesh with per-instance color is simpler. Per-category meshes (4 InstancedMeshes, one per category) means each can use a slightly different shader for category-specific effects later. We're using approach 1 unless there's a strong reason. Log if you deviate.
3. **Cluster jitter algorithm.** Deterministic from signal ID — must be the same every time so a marker doesn't visibly hop when data refreshes. Document the algorithm (e.g., "first 8 chars of UUID → two floats in [-1, 1] → scaled by 1% of sphere radius, applied tangent to surface").

**Definition of done:**
- Markers visible at correct countries (verify by rotating globe to several known hot zones in the fixture data)
- Colors correctly bound to category
- Most recent marker pulses (subtle, slow)
- FPS still 60.0 — adding markers should not have moved the needle
- Grep confirms zero allocations inside `useFrame` (no `new`, no `[]` literals, no `{}` literals in the hot path)
- One commit, LOG.md updated

**Cut order if perf is bad:**
1. Cut event count cap from 50 to 25
2. Switch billboards → sphere or vice versa, whichever is faster
3. Drop the pulse animation (re-add in Phase 6)

---

## Phase 4 — Interaction (gestures, popups, sheet)

**Estimated:** 75-90 minutes.

**Goal:** The globe responds to touch. Pinch to zoom, drag to rotate, tap a marker to see a popup with signal info, tap "more" to expand the popup, tap "full details" to open the bottom sheet with the intelligence center / signal detail. Idle auto-rotation pauses on touch and resumes after 5 seconds.

**This is the phase where Reanimated and `@gorhom/bottom-sheet` finally get added.** Resume the deferred dependencies. CLAUDE.md and Phase 0's LOG.md note the version migration considerations (Reanimated v4, separate worklets package).

**In scope:**

*Gestures (`scene/GestureLayer.tsx`):*
- `react-native-gesture-handler` Pan and Pinch gestures
- Gestures write to Reanimated shared values OR refs (NOT React state)
- A `useFrame` reads the values and applies camera rotation/zoom
- Idle rotation continues unless `isInteracting` is true; resumes 5s after last gesture
- Camera transform is NEVER a React prop

*Tap detection (`scene/CameraRig.tsx` or sibling):*
- Convert tap coordinates to a ray, raycast against the markers InstancedMesh
- On hit: write `selectedSignalId` to the store
- Camera lerps via quaternion slerp toward selected marker (NOT euler interpolation)

*Popup (`ui/MarkerPopup.tsx`):*
- 2D RN component, NOT in 3D. Position calculated by projecting selected marker's world position to screen coords each frame.
- ~280px wide, ~120px tall in initial state
- Shows: category pill, country code, freshness ("2h"), title (truncated), severity bar, "more →" affordance
- Three states: glance (initial, ~280×120), expanded (~2x size, with summary + 1-2 evidence rows + "full details →"), dismissed
- Smart placement: flips above/below to stay on screen
- Subtle connector line from popup to marker
- Style strictly per aesthetic spec — no colors outside the palette

*Bottom sheet (`ui/BottomSheet.tsx`):*
- `@gorhom/bottom-sheet` v5 with snap points `['15%', '50%', '85%']`
- Default snap: peek (15%)
- Single sheet, two content modes:
  - **Intelligence center** (default): live indicator, top stats, breaking headlines, top regions list. The 50% and 85% snaps reveal more sections (source mix, accelerating, ticker, filter rail) — but those panels can be stubbed with placeholder text in this phase if time pressure exists; the *layout* is what matters. Phase 5 fills them in.
  - **Signal detail** (when `selectedSignalId !== null` AND user has tapped "full details →" on the popup): replaces the intelligence center content. Header has a "← back to overview" affordance that clears the selection.
- Tapping a region/headline in the intelligence center triggers a camera fly-to AND auto-shows the popup for the most relevant marker there. Sheet stays at its current snap.

*Idle behavior:*
- Auto-rotation runs by default
- On any gesture, it pauses
- After 5s of no gesture, resumes

**Out of scope:**
- The intelligence center panels can be stubbed (just placeholder text/loading skeletons) — Phase 5 wires the real data
- Source-mix bars, velocity leaderboard with real data — Phase 5
- Live ticker — Phase 5
- Filter rail wired to actually filter the globe — Phase 5
- Cluster density math — Phase 6
- Linked market chip in detail view — Phase 7

**Decisions to make and log:**
1. **Reanimated v4 setup.** New Babel plugin path, separate worklets package, possible breaking changes from v3 idioms. Document any non-obvious config.
2. **Sheet content swap mechanism.** Two components conditionally rendered based on `selectedSignalId`, OR one component that branches internally. Pick simpler.
3. **Hit testing scale.** Markers are small (a few pixels onscreen at default zoom). Add a hit-test scale factor (e.g., raycast against 1.5x the visual size) so taps don't require pixel-perfect aim. Document the multiplier chosen.
4. **Popup state management.** Local state on the popup component, OR in the store? If in the store, easy to dismiss programmatically (e.g., when sheet opens). Probably in store.

**Definition of done:**
- Drag rotates the globe, pinch zooms
- Idle rotation pauses on touch, resumes 5s after release
- Tapping a marker shows a small popup near it
- Tapping "more →" expands the popup
- Tapping "full details →" opens the sheet at 50% with detail content
- Dismissing the sheet (drag down past peek) returns to intelligence center
- Tapping empty globe dismisses the popup
- All animations smooth, no dropped frames
- FPS still 60.0 during interaction
- One commit, LOG.md updated

**Cut order if perf is bad:**
1. Drop the connector line from popup to marker
2. Simplify popup transition (no animated expand → instant resize)
3. Reduce camera lerp smoothness

---

## Phase 5 — Dashboard (intelligence center, real data)

**Estimated:** 45-60 minutes.

**Goal:** Fill in the intelligence center sections with real data from the API. The bottom sheet, already mounted in Phase 4 with stubs, now shows actual content.

**In scope:**

*Stats section (15% peek, fully visible at all snap points):*
- Live indicator with current time
- Three key stats from `/explorer/overview`: active signals, evidence/24h, active countries
- Format with mono font, large numbers, small labels

*Sections at 50% snap:*
- **Top regions** — list of 3-4 hot countries, derived from `useCountryHeat()` selector sorted by `heatScore` desc. Each row tappable: triggers camera fly-to + popup show.
- **Breaking headlines** — 3-4 rows from `/explorer/overview.breaking_news`. Title (ellipsized), source name, time. Each row tappable: opens link OR shows the corresponding signal popup if linkable.

*Sections at 85% snap:*
- **Source mix** — small bar chart (or just bars made of divs) showing `evidence_type` proportions from `/signals/facets`. e.g., "news 68% · tweets 31%".
- **Accelerating ↑** — top 5 from `/signals?sort=velocity&limit=5`, each row showing `delta_pct`, country code, title (truncated). Tappable like the rows above.
- **Live ticker** — recent evidence items, derived from current signals' `top_evidence` arrays. Sorted by time desc, limited to most recent 10-15. Each row: time, type (NEWS/TWEET), country, title.
- **Filter rail** — categories from `/signals/facets`, each with count. Tap to toggle filter. When a filter is active, it applies to the globe's visible markers AND the data shown elsewhere in the sheet.

*Filter integration:*
- Wire the filter state to the store
- `useVisibleEvents()` selector applies the filter
- Markers fade in/out as filter changes — animation in `useFrame`, NOT a React re-render of the InstancedMesh
- The dashboard sections also re-derive based on filter (e.g., "top regions" reflects filtered events)

**Out of scope:**
- Bottom-sheet detail view sections (those use Phase 4's stub or get filled in Phase 7)
- Chart libraries — bars are just `<View>` with widths
- Animated number transitions on stat updates — nice-to-have, skip
- Pull-to-refresh — react-query handles staleness; trust it

**Decisions to make and log:**
1. **Filter behavior on the globe.** Hard cut (markers disappear) or fade animation? Fade looks better but requires animation logic in `useFrame`. Either is fine; document the call.
2. **Live ticker freshness.** Re-derives every time the underlying signals refresh (every 60s). Document if you take a different approach.
3. **Number formatting.** "9341" vs. "9.3K" — pick one and be consistent. Mono font helps either way.

**Definition of done:**
- Sheet at peek shows live stats
- Sheet at mid shows top regions and breaking headlines, both with working tap-to-locate
- Sheet at full shows source mix, accelerating, ticker, filter rail
- Filter rail toggles actually filter the globe AND update sheet content
- All data is real (from fixtures or live API), no placeholders remain
- FPS still 60.0
- One commit, LOG.md updated

---

## Phase 6 — Polish (cluster boost, heat tint, pulse, optional arcs)

**Estimated:** 30-45 minutes.

**Goal:** Wire up the visual effects that have been stubbed throughout. The "make it look intentional" pass.

**In scope:**
- **Cluster boost on marker sizes.** Implement the angular-distance + falloff formula in `domain/encodings.ts:clusterBoost`. Markers in dense regions appear larger; isolated markers stay base size. Compute once per data update, store on the event.
- **Country surface heat tint.** Wire the Phase 2 stub uniform to actual `heatScore` values. Hot countries glow warm via the heat-tint gradient. Use a uniform array indexed by country (or a 1D texture if simpler). Smooth gradient, NOT bucketed.
- **Pulse on most recent marker.** Already in Phase 3 — verify it's working and tune the timing if needed.
- **Optional: arcs between same-category recent signals.** Single merged BufferGeometry with curved geometry (quadratic Bezier in 3D, control point pushed outward from sphere center). Cap at 3-5 arcs visible. Only the most recent arc has an animated traveling dot; others are static. Cool, low-alpha. CUT THIS FIRST IF PERF DIPS.

**Out of scope:**
- Linked market chip (Phase 7)
- Ground-view toggle (Phase 7)
- Sort-mode toggle (Phase 7)
- Country deep-dive panel (Phase 7)
- Towers (deferred to potential v2)

**Decisions to make and log:**
1. **Cluster boost falloff exponent.** Start with `(1 - d/r)^2`. Crank to `^4` if cluster shape feels too diffuse. Log the chosen value.
2. **Heat tint uniform shape.** Array of vec3s indexed by country index, OR a 1D data texture. Texture is more scalable but more setup. Array is simpler and 250 entries is fine. Probably array.
3. **Arcs: ship or skip.** If FPS is healthy after cluster boost and heat tint, ship arcs. If anything is borderline, skip and document.

**Definition of done:**
- Hot regions visibly glow on the country surface
- Marker sizes reflect cluster density
- Pulse on most-recent marker is subtle but visible
- (Optional) arcs render correctly and don't tank FPS
- FPS still 60.0
- One commit, LOG.md updated

---

## Phase 7 — Stretch (only if time)

**Estimated:** budget whatever remains, capped at 30 minutes.

**Goal:** Pick the highest-value items based on what shipped. Do not attempt everything.

**Candidates, prioritized:**

1. **Linked market chip in signal detail.** Each signal has `primary_market` already in the payload. Render a chip in the bottom-sheet detail view: market title, current price, recent move. This is THE differentiator — showing you understand Kosmos's signal-to-market thesis. Worth doing if at all possible.

2. **Sort-mode toggle.** A small segmented control in the dashboard: top / recent / velocity. Changes the API query for the markers list. Globe re-arranges as the data shifts. Demo moment.

3. **Ground-view toggle.** A button in the dashboard. When on, thin lines drop from each orbital marker down to the country surface — connecting signals to their place. Cheap to implement (one merged LineSegments BufferGeometry), genuinely cool visual.

4. **Country deep-dive panel.** Tap a country (not just a marker — a country plate) → fetches `/api/v2/globe/region/{country}` → bottom sheet shows top signals + open markets in that country. More API integration to demo.

5. **Geographic coverage expansion.** If the live API is now returning signals from underrepresented regions (Africa, South America, Southeast Asia — absent in the May 2026 fixture data due to news-cycle skew), verify those countries render correctly. The pipeline handles them automatically, but worth a visual pass to confirm no centroid lookup issues, no Z-fighting at unusual latitudes, and that jitter stays on-surface near the equator where marker density could increase.

**Decisions:**
- Pick at most 2 of the 4 above. Quality > quantity. If 1 is well-done, that's better than 3 half-done.
- If nothing on this list feels feasible in the remaining time, **skip Phase 7 entirely and go straight to Phase 8**. Don't break the build chasing polish.

**Definition of done:**
- Whatever shipped works smoothly
- No regressions in FPS
- One commit, LOG.md noting what was built and what was deliberately skipped

---

## Phase 8 — Ship (sacred, do not skip)

**Estimated:** 15-20 minutes. Don't compress this.

**Goal:** A submittable artifact: clean repo, working README, screen recording, pushed to GitHub.

**Tasks:**

1. **README.md** at project root with these sections:
   - **What this is** — 1-2 sentences. "kosmosglobe: a native iOS visualization of the Kosmos OSINT API as an interactive 3D globe."
   - **Demo** — embed or link the screen recording
   - **Setup**:
     ```
     npm install
     npx expo prebuild --platform ios
     npx expo run:ios
     ```
     Note that fixtures are bundled, so it works offline. Note any required Node version.
   - **Architecture notes** — 1 paragraph. Domain/scene/layers ring boundaries, store-driven rendering, InstancedMesh + version-stamped sync, fixtures-by-default. The reader should walk away knowing this isn't accidental.
   - **Design decisions** — 1 paragraph each on: visual direction (why we avoided the generic 3D-globe look, what aesthetic we chose and why), interaction model (popup escalation, sheet as intelligence center), API integration (which endpoints, why those, what we'd add next).
   - **What's not built** — honest list of cut features and why. This signals self-awareness, not weakness.
   - **What I'd do with another day** — 3-5 items. Linked market chip if not shipped, websocket relay for true real-time, evidence detail view, region deep-dive, etc.

2. **Screen recording.** Use the iOS simulator's recording feature: `xcrun simctl io booted recordVideo --codec h264 demo.mov` then stop with Ctrl+C. Aim for 30-45 seconds covering: app launch with rotating globe, dashboard at peek state, drag/zoom interaction, tap a marker → popup → expanded → bottom sheet, filter rail in action, one tap-to-locate from the dashboard. Trim the start/end if needed.

3. **Final cleanup**:
   - Remove any `console.log` debug spam
   - Verify FPS counter still visible (it's a feature for the demo)
   - Confirm fixtures are checked in
   - `npm run` whatever lint/type check exists, fix anything that surfaces
   - Confirm `.env` is gitignored if it exists; `.env.example` checked in

4. **Final commit**: `phase 8: docs, demo, ready for review`

5. **Push to GitHub**: `git push origin main`

6. **LOG.md final entry**: brief retrospective. What surprised you, what worked, what didn't.

**Definition of done:**
- README reads well to a stranger
- Recording demonstrates the product in under a minute
- Repo is on GitHub, link works
- App still runs cleanly via the README's setup instructions (verify by deleting `node_modules` and `ios/`, running the setup steps fresh)
- LOG.md tells the story of the build

---

## Universal cut order if time runs out

In any phase, if it becomes clear we won't finish: cut features in this order before cutting quality.

1. Cut Phase 7 (stretch) entirely
2. Cut Phase 6 arcs
3. Cut Phase 6 heat-tint smoothness (use bucketed instead of gradient)
4. Cut bottom sheet's 85% content (Phase 5 — keep mid only)
5. Cut filter rail (Phase 5 — display only, not interactive)
6. Cut popup expansion state (Phase 4 — straight from glance to sheet)
7. Cut atmosphere fresnel (Phase 2)

Phase 8 is sacred. Always ship.

---

## Reminders

- The 3D scene tree mounts ONCE. Never re-renders.
- ONE InstancedMesh per visual concept.
- `useFrame` allocates nothing.
- Gestures write to refs, never state.
- 50 events max rendered.
- Aesthetic palette is locked. No new colors.
- Each phase ends with commit + LOG.md + stop.
- When unsure, re-read CLAUDE.md.
