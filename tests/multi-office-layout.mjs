// Pure-function checks for the multi-office layout. No browser, no deps:
//   node tests/multi-office-layout.mjs
// It slices the projection + layout + hit-test section out of desktop/plugin.js
// (the file imports the Hermes SDK, so it cannot be imported directly).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = fs.readFileSync(path.join(repo, 'desktop/plugin.js'), 'utf8')
const cut = (from, to) => src.slice(src.indexOf(from), src.indexOf(to))
const mod = cut('const ISO_X', '// Hit testing.') + cut('const DESK_W = 2.2', '// Palette that FOLLOWS') +
  '\nexport {sceneLayout, officeGroups, normalizeOffices, layoutSlot, hitTestDesks, hitTestAgents, deskSlot, loungeIndexes, loungeSlot, loungeSeatsFor, screenToWorld, dropTargetAt}\n'
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'office3d-')), 'layout.mjs')
fs.writeFileSync(tmp, mod)
const { sceneLayout, officeGroups, normalizeOffices, layoutSlot, hitTestDesks, hitTestAgents, deskSlot, loungeIndexes, loungeSlot, loungeSeatsFor, screenToWorld, dropTargetAt } = await import(pathToFileURL(tmp))
// Legacy (no offices) is unchanged.
const L6 = sceneLayout(6)
assert.equal(L6.zones.length, 1)
assert.deepEqual(L6.slots[5], deskSlot(5, 3))
assert.equal(L6.workH, 3.2 + 3.3)
assert.equal(L6.multi, undefined)
assert.equal(sceneLayout(6, null).projW, L6.projW)
assert.deepEqual(loungeIndexes([{ online: true }, { online: true, busy: true }, { online: false }], L6), [0])
assert.equal(dropTargetAt(L6, 1, 1), null, 'no drag targets without offices')

// Office names.
assert.deepEqual(normalizeOffices(' A \nb,a,,Unassigned, Lounge, C'), ['A', 'b', 'C'])

const offices = ['MokLabs-TI', 'Comercial', 'Operaciones', 'Personas', 'Finanzas', 'Riesgos', 'Travel']
const names = ['default', 'devops', 'sre', 'senior_qa', 'global_tech_lead', 'pedrobot', 'mia-asistente', 'senior_developer']
const entries = names.map((profile, i) => ({ profile, online: i !== 4, busy: i % 3 === 0 }))
const asg = { devops: 'MokLabs-TI', sre: 'MokLabs-TI', senior_qa: 'MokLabs-TI', senior_developer: 'MokLabs-TI', pedrobot: 'Comercial', 'mia-asistente': 'Personas', global_tech_lead: 'Ghost' }
const g = officeGroups(entries, offices, asg)
assert.equal(g.length, 8)
assert.ok(g[7].lounge)
assert.deepEqual(g[7].members, [0, 4], 'unassigned + stale assignment wait in the lounge')
assert.equal(officeGroups(entries, [], asg), null)

const L = sceneLayout(entries.length, g)
assert.ok(L.multi)
assert.equal(L.zones.length, 7, 'one room per office, no Unassigned room')
assert.equal(layoutSlot(L, 0), null, 'unassigned profile has no desk')
assert.equal(layoutSlot(L, 4), null)
// Lounge: idle ones + every unassigned one (busy default, offline global_tech_lead).
assert.deepEqual(loungeIndexes(entries, L), [0, 1, 2, 4, 5, 7])

// Every desk inside its own room; rooms never overlap.
g.filter((x) => !x.lounge).forEach((grp, zi) => {
  const z = L.zones[zi]
  for (const i of grp.members) {
    const s = L.slots[i]
    assert.ok(s.x >= z.x0 && s.x + 2.2 <= z.x0 + z.w && s.y >= z.y0 && s.y + 1.1 <= z.y0 + z.h, `slot ${i} in ${z.name}`)
  }
})
for (const a of L.zones) for (const b of L.zones) if (a !== b) {
  assert.ok(a.x0 + a.w <= b.x0 || b.x0 + b.w <= a.x0 || a.y0 + a.h <= b.y0 || b.y0 + b.h <= a.y0, a.name + '/' + b.name)
}
assert.ok(L.loungeY0 >= L.workH)

// Projection helpers for the checks below.
const ISO_X = Math.SQRT1_2
const frame = { ox: 400, oy: 50, scale: 20, layout: L }
const toScreen = (x, y, z = 0) => [frame.ox + (x - y) * ISO_X * 20, frame.oy + ((x + y) * 0.5 - z) * 20]

// Clicking the middle of every desk picks that profile.
entries.forEach((e, i) => {
  const s = layoutSlot(L, i)
  if (!s) return
  const [px, py] = toScreen(s.x + 1.1, s.y + 0.55, 0.8)
  assert.equal(hitTestDesks(entries, frame, px, py), i, 'hit desk ' + e.profile)
})

// Lounge sitters are grabbable (and win over desks).
const seats = loungeSeatsFor(entries, L)
assert.deepEqual(seats.filter((x) => x.waiting).map((x) => x.i), [0, 4], 'unassigned wait in line')
// Waiting spots sit inside the lounge floor and well apart.
for (const a of seats) {
  assert.ok(a.slot.x > 0 && a.slot.x < L.worldW && a.slot.y > L.loungeY0 && a.slot.y < L.loungeY0 + 6, 'seat inside lounge')
  for (const b of seats) if (a !== b) assert.ok(Math.hypot(a.slot.x - b.slot.x, a.slot.y - b.slot.y) > 0.5, 'seats apart')
}
// All 8 unassigned (fresh install) still fit in the waiting rows.
const fresh = sceneLayout(entries.length, officeGroups(entries, offices, {}))
const freshSeats = loungeSeatsFor(entries, fresh)
assert.equal(freshSeats.length, 8)
assert.ok(freshSeats.every((x) => x.waiting))
const f2 = { ...frame, loungeSeats: seats }
for (const { i, slot } of seats) {
  const [px, py] = toScreen(slot.x, slot.y, 0.9)
  assert.equal(hitTestAgents(entries, f2, px, py), i, 'grab lounge sitter ' + names[i])
}

// screen -> world round trip, and drop targets.
for (const [x, y] of [[0.3, 0.4], [12.5, 7.1], [3, 20]]) {
  const w = screenToWorld(frame, ...toScreen(x, y))
  assert.ok(Math.abs(w.x - x) < 1e-9 && Math.abs(w.y - y) < 1e-9, 'round trip')
}
for (const z of L.zones) {
  const t = dropTargetAt(L, z.x0 + z.w / 2, z.y0 + z.h / 2)
  assert.equal(t && t.office, z.name, 'drop on ' + z.name)
}
assert.equal(dropTargetAt(L, L.worldW / 2, L.loungeY0 + 1).office, '', 'drop on lounge = unassign')
assert.equal(dropTargetAt(L, -5, -5), null, 'off the floor = no target')

// Crowded lounge: >8 sitters spill onto an outer ring, all distinct.
const ring = Array.from({ length: 12 }, (_, i) => loungeSlot(i, 12, L.lounge))
for (let a = 0; a < ring.length; a++) for (let b = a + 1; b < ring.length; b++) {
  assert.ok(Math.hypot(ring[a].x - ring[b].x, ring[a].y - ring[b].y) > 0.5, `seats ${a}/${b} apart`)
}
assert.deepEqual(loungeSlot(3, 6, L.lounge), loungeSlot(3, 6, L.lounge))

console.log('ALL OK', JSON.stringify(L.zones.map((z) => [z.name, z.count])))
