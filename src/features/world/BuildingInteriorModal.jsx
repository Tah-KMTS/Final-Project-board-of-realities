import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { INTERIOR_BUILDINGS_CATALOG } from './interiorObjectsCatalog'

export default function BuildingInteriorModal({ buildingId = 'general_hospital', onClose }) {
  const building = INTERIOR_BUILDINGS_CATALOG[buildingId] || INTERIOR_BUILDINGS_CATALOG.general_hospital
  const [activeRoomId, setActiveRoomId] = useState(building.rooms[0]?.id || 'main_lobby')
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const healPlayer = useGameStore((s) => s.healPlayer || (() => {}))
  const addCash = useGameStore((s) => s.addCash)

  const activeRoom = building.rooms.find((r) => r.id === activeRoomId) || building.rooms[0]

  const handleUseEquipment = (eq) => {
    if (eq.id === 'defibrillator' || eq.id === 'patient_bed') {
      healPlayer(100)
      setFeedbackMsg(`🩺 USED EQUIPMENT: ${eq.name}! (${eq.effect})`)
    } else if (eq.id === 'vault_door') {
      addCash(50000)
      setFeedbackMsg(`🔐 VAULT CRACKED: Force opened ${eq.name}! Stole $50,000 in Gold Bullion!`)
    } else {
      setFeedbackMsg(`⚙️ OPERATED EQUIPMENT: ${eq.name}! (${eq.effect})`)
    }
  }

  const handleInspectVehicle = (v) => {
    setFeedbackMsg(`🚗 STATIONED VEHICLE: Inspected ${v.name} (${v.status}). Ready for emergency dispatch!`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 font-mono text-white">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col border-4 border-cyan-500/80 bg-[#0a0f21] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-cyan-500/40 bg-[#121936] px-6 py-4">
          <div>
            <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs font-bold text-cyan-300 uppercase tracking-wider">BUILDING INTERIOR EXPLORATION</span>
            <h1 className="text-2xl font-bold text-cyan-300 mt-1">{building.buildingName}</h1>
          </div>
          <button
            onClick={onClose}
            className="border-2 border-red-500 bg-red-950 px-4 py-1.5 text-xs font-bold text-red-300 hover:bg-red-600 hover:text-white transition-all"
          >
            🚪 EXIT BUILDING (TO OVERWORLD)
          </button>
        </div>

        {/* Room Navigation Tabs */}
        <div className="flex border-b border-gray-800 bg-[#161d3b] px-6 py-2.5 gap-2 text-xs font-bold flex-wrap">
          <span className="text-gray-400 self-center">Interior Rooms:</span>
          {building.rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => setActiveRoomId(room.id)}
              className={`px-3 py-1.5 rounded transition-all ${
                activeRoomId === room.id ? 'bg-cyan-500 text-black font-extrabold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {room.name}
            </button>
          ))}
        </div>

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div className="bg-cyan-950/90 border-b border-cyan-400 p-2.5 text-center text-xs font-bold text-cyan-200">
            {feedbackMsg}
          </div>
        )}

        {/* Active Room Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded border border-cyan-500/40 bg-[#111730] p-4">
            <h2 className="text-xl font-bold text-yellow-300 mb-1">{activeRoom.name}</h2>
            {activeRoom.npc && (
              <div className="mt-2 text-xs text-gray-300">
                Stationed NPC: <b className="text-cyan-300">{activeRoom.npc.name}</b> ({activeRoom.npc.title})
              </div>
            )}
          </div>

          {/* Interactive Equipment Section */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Interactive Equipment & Machinery:</h3>
            {activeRoom.equipment?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeRoom.equipment.map((eq) => (
                  <div key={eq.id} className="rounded border border-cyan-500/30 bg-[#151c3a] p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-cyan-300">{eq.name}</div>
                      <div className="text-[11px] text-gray-300 mt-0.5">{eq.effect}</div>
                    </div>
                    <button
                      onClick={() => handleUseEquipment(eq)}
                      className="rounded border border-cyan-400 bg-cyan-950 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500 hover:text-black transition-all"
                    >
                      Operate
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic">No equipment in this room area.</div>
            )}
          </div>

          {/* Stationed Vehicles Section */}
          {activeRoom.vehicle && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Stationed Emergency / Corporate Vehicles:</h3>
              <div className="rounded border border-amber-500/40 bg-[#211a12] p-3 text-xs flex items-center justify-between">
                <div>
                  <div className="font-bold text-amber-300 text-sm">🚗 {activeRoom.vehicle.name}</div>
                  <div className="text-[11px] text-gray-300 mt-0.5">Status: {activeRoom.vehicle.status}</div>
                </div>
                <button
                  onClick={() => handleInspectVehicle(activeRoom.vehicle)}
                  className="rounded border border-amber-400 bg-amber-950 px-4 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-black transition-all"
                >
                  Inspect / Drive
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 bg-[#0d1226] p-4 text-right">
          <button
            onClick={onClose}
            className="border-2 border-red-500 bg-red-950 px-6 py-2 text-xs font-bold text-red-300 hover:bg-red-600 hover:text-white transition-all"
          >
            🚪 Exit Building to Overworld
          </button>
        </div>
      </div>
    </div>
  )
}
