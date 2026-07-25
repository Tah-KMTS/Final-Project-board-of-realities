// Universal character resolver across every roster (Financial Titans, Crime
// Syndicate, Presidents, Fed Chairmen, FTC Chairmen, Famous Agency Leaders).
// Before this existed, NamedNpcModal.jsx only ever checked FINANCE_NPCS, so
// every non-titan character (all 21 crime syndicate members, all 30
// government figures, all agency heads) displayed as its raw id string with
// a fake "Titan" / $1B placeholder instead of their real name/title. This is
// the single source of truth both NamedNpcModal.jsx and the world-spawn
// system use to resolve "who is this id" regardless of which roster they're
// actually defined in.

import { FINANCE_NPCS } from '../finance/financeNpcs'
import { CRIME_SYNDICATES } from '../government/crimeSyndicates'
import { PRESIDENTS_ROSTER, FED_CHAIRMEN_ROSTER, FTC_CHAIRMEN_ROSTER } from '../government/governmentRoster'
import { FAMOUS_AGENCY_LEADERS } from '../government/famousAgencyRoster'
import { getCharacterSpritePalette } from '../../data/characterPortraits'

function flattenCrime() {
  const out = []
  for (const syndicate of CRIME_SYNDICATES) {
    for (const role of ['boss', 'underboss', 'capo']) {
      const member = syndicate[role]
      out.push({
        id: member.id,
        name: member.name,
        title: member.title,
        category: `Crime Syndicate ${role[0].toUpperCase()}${role.slice(1)}`,
        netWorth: member.extortionPower ? member.extortionPower * 100000 : 50000000,
        palette: member.palette,
        district: 'Osaka District',
        syndicateName: syndicate.name,
        territory: syndicate.territory,
        specialty: syndicate.specialty,
      })
    }
  }
  return out
}

function flattenAgencyLeaders() {
  const out = []
  for (const [agency, leaders] of Object.entries(FAMOUS_AGENCY_LEADERS)) {
    for (const leader of leaders) {
      out.push({
        id: leader.id,
        name: leader.name,
        title: leader.title,
        category: `${agency.toUpperCase()} Leader`,
        netWorth: 5000000,
        bio: leader.background,
      })
    }
  }
  return out
}

const CRIME_FLAT = flattenCrime()
const AGENCY_FLAT = flattenAgencyLeaders()

// Cheap lookup index built once, not on every call.
const INDEX = new Map()
for (const npc of FINANCE_NPCS) INDEX.set(npc.id, { ...npc, category: 'Financial Titan' })
for (const c of CRIME_FLAT) INDEX.set(c.id, c)
for (const p of PRESIDENTS_ROSTER) INDEX.set(p.id, { ...p, title: p.party, category: 'US President', netWorth: 400000 })
for (const f of FED_CHAIRMEN_ROSTER) INDEX.set(f.id, { ...f, category: 'Federal Reserve Chairman', netWorth: 8000000 })
for (const t of FTC_CHAIRMEN_ROSTER) INDEX.set(t.id, { ...t, category: 'FTC Chairman', netWorth: 3000000 })
for (const a of AGENCY_FLAT) INDEX.set(a.id, a)

// Every character needs a sprite palette to walk the overworld; rosters
// that don't carry one fall back to their portrait colors.
for (const entry of INDEX.values()) {
  if (!entry.palette) entry.palette = getCharacterSpritePalette(entry.id) || { skin: '#e0c090', hair: '#444444', outfit: '#2a2a3e' }
}

export function getAnyCharacter(id) {
  return INDEX.get(id) || null
}

export function getAllCharacterIds() {
  return Array.from(INDEX.keys())
}

export function getAllCharacters() {
  return Array.from(INDEX.values())
}
