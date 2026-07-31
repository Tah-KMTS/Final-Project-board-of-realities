import { useState } from 'react'
import { Heart, Briefcase } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { getAnyCharacter } from '../agents/characterLookup'
import { getCharacterPortrait } from '../../data/characterPortraits'
import NamedNpcModal from '../finance/NamedNpcModal'

// Phone's Contacts & Romance app. Unlike the other 3 phone apps this isn't a
// tab bar over existing hub modals - it's a new list view (per the task) that
// surfaces every NPC the player actually has a relationship with, each entry
// opening the same NamedNpcModal (embedded) used everywhere else in the game
// for dating/marriage/recruit actions. No new store logic: reads
// world2.romanceState.relationships (a flat { [npcId]: number 0-100 } map -
// courtCharacter() in romanceEngine.js writes a plain level, not a
// tier/stage object) and world2.romanceState.spouses / world2.recruitedAdvisors
// straight off the existing store.
function relationshipLabel(level, isSpouse) {
  if (isSpouse) return 'Married'
  if (level >= 75) return 'Devoted'
  if (level >= 50) return 'Serious'
  if (level >= 25) return 'Dating'
  return 'Acquainted'
}

export default function ContactsApp() {
  const world2 = useGameStore((s) => s.world2)
  const [openNpcId, setOpenNpcId] = useState(null)

  const romanceState = world2.romanceState || { relationships: {}, spouses: [] }
  const relationships = romanceState.relationships || {}
  const spouses = romanceState.spouses || []
  const recruitedAdvisors = world2.recruitedAdvisors || []

  // Union of every npcId with an active romance level (>0) or recruited
  // status, richest relationship first so the people the player has
  // invested the most in float to the top.
  const contactIds = Array.from(
    new Set([...Object.keys(relationships).filter((id) => relationships[id] > 0), ...recruitedAdvisors])
  )

  const contacts = contactIds
    .map((id) => {
      const npc = getAnyCharacter(id)
      if (!npc) return null
      const level = relationships[id] || 0
      const isSpouse = spouses.includes(id)
      const isRecruited = recruitedAdvisors.includes(id)
      return { id, npc, level, isSpouse, isRecruited }
    })
    .filter(Boolean)
    .sort((a, b) => b.level - a.level)

  if (openNpcId) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <button
          onClick={() => setOpenNpcId(null)}
          className="mb-2 shrink-0 self-start rounded border border-gray-600 px-2 py-1 text-[10px] font-bold text-gray-300 hover:border-gray-400"
        >
          ← Back to Contacts
        </button>
        <div className="flex-1 overflow-y-auto">
          <NamedNpcModal npcId={openNpcId} embedded />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-2 shrink-0 text-[10px] font-bold uppercase tracking-wide text-rose-300">
        Contacts & Romance ({contacts.length})
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {contacts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-gray-400">
            <Heart size={28} className="text-rose-400/70" />
            <p className="text-xs font-bold text-gray-300">No contacts yet.</p>
            <p className="max-w-[220px] text-[10px] italic text-gray-500">
              Date, marry, or recruit NPCs out in the world - they'll show up here once you do.
            </p>
          </div>
        ) : (
          contacts.map(({ id, npc, level, isSpouse, isRecruited }) => (
            <button
              key={id}
              onClick={() => setOpenNpcId(id)}
              className="flex w-full items-center gap-2.5 rounded border border-rose-500/30 bg-rose-950/10 p-2 text-left hover:border-rose-400/60 hover:bg-rose-500/10"
            >
              <img
                src={getCharacterPortrait(id)}
                alt={npc.name}
                className="h-10 w-10 shrink-0 rounded border border-rose-400/50 object-cover bg-slate-900"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="truncate text-xs font-bold text-yellow-300">{npc.name}</span>
                  {isRecruited && (
                    <Briefcase size={10} className="shrink-0 text-emerald-400" title="Recruited Advisor" />
                  )}
                </div>
                <div className="truncate text-[10px] text-gray-400">{npc.title}</div>
                {level > 0 && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/50">
                      <div
                        className="h-full bg-fuchsia-500"
                        style={{ width: `${level}%` }}
                      />
                    </div>
                    <span className={`shrink-0 text-[9px] font-bold ${isSpouse ? 'text-yellow-300' : 'text-fuchsia-300'}`}>
                      {relationshipLabel(level, isSpouse)}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
