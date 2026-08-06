export default function AmbientNpcModal({ npcName, onClose, onMug, onAttack, feedback }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-[380px] border-4 border-gray-400 bg-[#1c1d3a] p-6 font-mono text-white">
        <h2 className="mb-3 text-xl font-bold text-gray-200">{npcName}</h2>
        <p className="mb-4 text-sm text-gray-400">"Oh- uh, hi. Can I help you with something?"</p>

        {feedback && (
          <div className="mb-3 border-2 border-orange-500 bg-orange-950/70 p-2 text-xs font-bold text-orange-200">
            {feedback}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button onClick={onMug} className="border-2 border-orange-400 py-1 text-sm hover:bg-orange-400 hover:text-black">
            Mug Them (+$50, Wanted +1)
          </button>
          <button onClick={onAttack} className="border-2 border-red-600 bg-red-700 py-1 text-sm font-bold hover:bg-red-600">
            Attack Them
          </button>
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full border-4 border-gray-500 py-2 font-bold hover:bg-gray-500"
        >
          Leave
        </button>
      </div>
    </div>
  )
}
