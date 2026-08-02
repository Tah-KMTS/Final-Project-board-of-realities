// Generates one home/hideout building def per character, programmatically
// from getAllCharacters(), in the exact shape FINANCE_BUILDING_DEFS entries
// use (OverworldScene.js) plus a `kind` discriminator. `npcId: c.id` is the
// entire integration point: WorldScreen.jsx already routes any `{type:
// 'building', npcId}` interaction straight to NamedNpcModal, so no new modal
// code is needed to make these buildings clickable.

import { getAllCharacters } from '../agents/characterLookup'
import { getDisposition } from '../agents/characterDispositions'
import { CHARACTER_BUILDINGS_CATALOG } from './characterBuildingsCatalog'
import { SYNDICATE_MEMBERS_BY_ID } from '../../data/syndicate'

const CATALOG_BY_OWNER = new Map(CHARACTER_BUILDINGS_CATALOG.map((b) => [b.ownerId, b]))

// Small tasteful fallback palette to hash into if a character ever has no
// usable outfit color. characterLookup.js backfills every roster entry with
// a palette today, so this path shouldn't currently be hit - kept only so a
// future roster gap can't crash building generation.
const FALLBACK_PALETTE = [0x6a4a3a, 0x2a3a5f, 0x5a3a2a, 0x3a5f4a, 0x4a1f6a, 0x2a5a6a, 0x6a1f1f, 0x8a5a1f]

function hashId(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

function colorForCharacter(character) {
  const outfit = character.palette && character.palette.outfit
  if (typeof outfit === 'string' && HEX_COLOR_RE.test(outfit)) {
    return parseInt(outfit.slice(1), 16)
  }
  return FALLBACK_PALETTE[hashId(character.id) % FALLBACK_PALETTE.length]
}

function stripDistrictSuffix(label) {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

function labelForCharacter(character, isCrime) {
  const catalogEntry = CATALOG_BY_OWNER.get(character.id)
  if (catalogEntry) return catalogEntry.buildingName

  if (isCrime) {
    const member = SYNDICATE_MEMBERS_BY_ID[character.id]
    if (member && member.homeBase) return stripDistrictSuffix(member.homeBase)
  }

  return `${character.name} ${isCrime ? 'Hideout' : 'Residence'}`
}

function buildDef(character) {
  const disposition = getDisposition(character.id)
  const isCrime = disposition ? disposition.isCrime : false
  return {
    id: `home_${character.id}`,
    label: labelForCharacter(character, isCrime),
    color: colorForCharacter(character),
    width: 2,
    height: 2,
    npcId: character.id,
    kind: isCrime ? 'hideout' : 'home',
  }
}

// Disambiguates any accidental duplicate labels deterministically. Verified
// empty against the current 88-character roster (see verification), kept as
// cheap insurance against a future roster addition silently colliding.
function dedupeLabels(defs) {
  const seen = new Map()
  for (const def of defs) {
    const count = seen.get(def.label) || 0
    seen.set(def.label, count + 1)
    if (count > 0) def.label = `${def.label} (${def.npcId})`
  }
  return defs
}

export const CHARACTER_HOME_BUILDING_DEFS = dedupeLabels(getAllCharacters().map(buildDef))

const DEFS_BY_CHARACTER_ID = new Map(CHARACTER_HOME_BUILDING_DEFS.map((d) => [d.npcId, d]))

export function getHomeBuildingDef(characterId) {
  return DEFS_BY_CHARACTER_ID.get(characterId) || null
}
