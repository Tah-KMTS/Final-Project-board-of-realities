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
        // Every syndicate member already carries an `aggression` (0-1) rating;
        // map it onto FINANCE_NPCS' bodyguardPower scale (roughly 3-10) so
        // generateBodyguardMonster() in financeNpcs.js produces a fight of
        // comparable difficulty for crime bosses/underbosses/capos, instead
        // of crashing (bodyguardPower used to not exist on this roster at all).
        bodyguardPower: Math.max(3, Math.min(10, Math.round((member.aggression || 0.6) * 10))),
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
        // Agency leaders have no rank/power field to derive from; use a flat
        // mid-tier default matching FINANCE_NPCS' bodyguardPower range
        // (4-10, most cluster around 5-7) rather than inventing a new stat.
        bodyguardPower: 6,
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
// bodyguardPower: 6 below is the same flat mid-tier default used for agency
// leaders (see flattenAgencyLeaders) - these rosters have no combat/rank
// stat of their own to derive from, and 6 sits mid-scale on FINANCE_NPCS'
// 4-10 bodyguardPower range so a Secret Service/security-detail fight with a
// President, Fed Chair, or FTC Chair feels comparable to a mid-tier titan's.
for (const npc of FINANCE_NPCS) INDEX.set(npc.id, { ...npc, category: 'Financial Titan' })
for (const c of CRIME_FLAT) INDEX.set(c.id, c)
for (const p of PRESIDENTS_ROSTER) INDEX.set(p.id, { ...p, title: p.party, category: 'US President', netWorth: 400000, bodyguardPower: 6 })
for (const f of FED_CHAIRMEN_ROSTER) INDEX.set(f.id, { ...f, category: 'Federal Reserve Chairman', netWorth: 8000000, bodyguardPower: 6 })
for (const t of FTC_CHAIRMEN_ROSTER) INDEX.set(t.id, { ...t, category: 'FTC Chairman', netWorth: 3000000, bodyguardPower: 6 })
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
