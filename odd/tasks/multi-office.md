# Feature: multi-office

**Objective.** Let the user create any number of named offices (default preset:
MokLabs-TI, Comercial, Operaciones, Personas, Finanzas, Riesgos, Travel) and
assign each Hermes profile to one, so the scene shows one work room per office
plus the shared lounge.

**Problem / why.** Upstream draws a single fixed WORK zone and a LOUNGE zone;
teams organised by area cannot see who works where.

**Scope.** `desktop/plugin.js` only (layout, drawing, hit testing, prefs,
settings page, detail panel), plus README/CHANGELOG/version. Backend and the
`office_status` tool are unchanged.

**Constraints.** Single-file ESM, SDK/react imports only, no build step.
Empty office list must reproduce the legacy single-room layout exactly.
Config lives in `ctx.storage` (desktop-local), like the existing prefs.

**TDD.** Mode: off (no project/session config). Source: none. Runner: none
configured; upstream browser tests need machine-specific node_modules paths.
Checks: ad-hoc node harness over the pure layout functions + headless render.

## Tasks

- [x] T1 Multi-office layout: `officeGroups`, `sceneLayout(count, groups)` with
      zones + per-entry slots, drawing of per-office floors/labels, hit testing.
- [x] T2 Config UI: offices list + per-profile assignment in Settings, office
      picker in the desk detail panel, prefs normalisation.
- [x] T3 Docs + version bump (README section, CHANGELOG 1.5.0, plugin.yaml).
- [x] T4 Unassigned profiles wait in the lounge (no Unassigned room), waiting
      rows clear of furniture; tea ring spills to an outer ring past 8.
      (User request 2026-11-05: "default in the lounge, then drag".)
- [x] T5 Drag a person (desk or lounge) onto an office to assign, onto the lounge
      to unassign; drop highlight + ghost chip; click/pan preserved.
- [x] T6 Docs + 1.6.0.

## Acceptance criteria

- No offices configured → identical legacy layout.
- N offices → N labelled rooms (empty ones included), unassigned profiles in an
  "Unassigned" room only when any exist, lounge shared below.
- Clicking a desk in any room selects the right profile.
- Offices can be added/renamed/removed from Settings; assignment persists.

## Progress / evidence

- Engram mirror `odd/multi-office/tasks`: **pending** (Engram tools not
  available in this session).

- T1+T2: `node tests/multi-office-layout.mjs` → ALL OK (legacy layout identical,
  8 rooms non-overlapping, desks inside their room, hit test per desk).
  Headless render in the built-in browser with the upstream SDK fixture: 7 named
  rooms + Unassigned + shared lounge; detail-panel picker moved a profile to
  Riesgos and the desk relocated. Settings page not rendered (fixture stubs
  ListRow/ToggleRow) — verify in Hermes Desktop.
- `hermes plugins validate .` → Validation passed.
- Upstream `tests/layout-browser.mjs` not run: Playwright browsers not installed.
- Layout tuning: rooms at least 2 desks wide, row aisle 2.6 so plates stay legible.

- 1.5.0 installed in all 8 profiles (plugins are per profile; the 404 seen in
  Desktop was the active profile lacking the plugin). User confirmed it works.
- T4+T5: `node tests/multi-office-layout.mjs` → ALL OK (no Unassigned room,
  waiting seats inside lounge and apart, lounge sitters grabbable, screen↔world
  round trip, drop targets). Browser fixture: 10 synthetic pointer drags with no
  pause and the pane hidden produced exactly the expected assignments; click
  without movement selects; click after a drag is swallowed.
- Found while testing: hit testing on the last painted frame grabbed the wrong
  person when frames lag; fixed with `computeFrame` on pointer events.

## Next step

Reinstall 1.6.0 in all profiles; user to try dragging in Desktop.
