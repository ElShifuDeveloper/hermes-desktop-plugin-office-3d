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
  '\nexport {sceneLayout, officeGroups, normalizeOffices, layoutSlot, hitTestDesks, deskSlot}\n'
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'office3d-')), 'layout.mjs')
fs.writeFileSync(tmp, mod)
const { sceneLayout, officeGroups, normalizeOffices, layoutSlot, hitTestDesks, deskSlot } = await import(pathToFileURL(tmp))
// legacy unchanged
const L6=sceneLayout(6); assert.equal(L6.zones.length,1); assert.deepEqual(L6.slots[5],deskSlot(5,3)); assert.equal(L6.workH,3.2+3.3); assert.equal(L6.multi,undefined)
assert.equal(sceneLayout(6,null).projW,L6.projW)
// normalize
assert.deepEqual(normalizeOffices(' A \nb,a,,Unassigned, C'),['A','b','C'])
const offices=['MokLabs-TI','Comercial','Operaciones','Personas','Finanzas','Riesgos','Travel']
const entries=['default','devops','sre','senior_qa','global_tech_lead','pedrobot','mia-asistente','senior_developer'].map(p=>({profile:p}))
const asg={devops:'MokLabs-TI',sre:'MokLabs-TI',senior_qa:'MokLabs-TI',senior_developer:'MokLabs-TI',pedrobot:'Comercial','mia-asistente':'Personas',global_tech_lead:'Ghost'}
const g=officeGroups(entries,offices,asg)
assert.equal(g.length,8); assert.equal(g[7].name,'Unassigned'); assert.deepEqual(g[7].members,[0,4])
assert.equal(officeGroups(entries,[],asg),null)
const L=sceneLayout(entries.length,g)
assert.equal(L.zones.length,8); assert.ok(L.multi)
// every slot inside its own zone, no two desks overlap
g.forEach((grp,zi)=>{const z=L.zones[zi];for(const i of grp.members){const s=L.slots[i];assert.ok(s.x>=z.x0&&s.x+2.2<=z.x0+z.w&&s.y>=z.y0&&s.y+1.1<=z.y0+z.h,`slot ${i} in ${z.name}`)}})
// zones don't overlap
for(const a of L.zones)for(const b of L.zones)if(a!==b)assert.ok(a.x0+a.w<=b.x0||b.x0+b.w<=a.x0||a.y0+a.h<=b.y0||b.y0+b.h<=a.y0,a.name+'/'+b.name)
assert.ok(L.loungeY0>=L.workH)
// hit test each desk center
const frame={ox:400,oy:50,scale:20,layout:L}
const ISO_X=Math.SQRT1_2
entries.forEach((e,i)=>{const s=layoutSlot(L,i);const x=s.x+1.1,y=s.y+0.55,z=0.8;const px=frame.ox+(x-y)*ISO_X*20,py=frame.oy+((x+y)*0.5-z)*20;assert.equal(hitTestDesks(entries,frame,px,py),i,'hit '+e.profile)})
console.log('ALL OK', JSON.stringify(L.zones.map(z=>[z.name,z.count,+z.x0.toFixed(1),+z.y0.toFixed(1)])))
