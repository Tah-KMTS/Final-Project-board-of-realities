// "What happened today" recap, shown once right after End Day resolves -
// see WorldScreen.jsx's handleEndDay, which snapshots cash/wantedLevel/
// notoriety/jail immediately before and after calling the store's endDay()
// and builds the `report` prop from the diff, plus whatever fresh entries
// endDay() just pushed onto world2.agentEventFeed (the same feed the
// Phone's Social/X app already reads - see AgentInteractionsModal.jsx).
// No new art/sprites: same text-only, no-external-assets treatment as
// WelcomeIntroModal.jsx, not a painted cutscene like the opening sequence
// (src/features/cutscene/) - endDay() runs on every single press, so a
// repeating event gets a report, not a scene.
//
// Deliberately does NOT try to surface every system endDay() touches (loan
// interest, syndicate standing decay, Fed rate moves, etc.) - those already
// show up where a player would naturally go looking for them (Banking app,
// Standing panel). This is a highlights reel: the numbers a player reads
// every single day (cash, Wanted, Notoriety), jail status if it applies,
// and the day's biggest stories, not an exhaustive audit.
function StatLine({ label, delta, formatDelta, neutral }) {
  const positive = delta > 0
  const negative = delta < 0
  const color = neutral || (!positive && !negative) ? 'text-gray-400' : positive ? 'text-green-400' : 'text-red-400'
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-1.5 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-bold ${color}`}>{formatDelta(delta)}</span>
    </div>
  )
}

export default function DailyReportModal({ report, onClose, onOpenFeed }) {
  const { dayEnded, daysLeft, cashDelta, wantedDelta, notorietyDelta, jailLine, headline, topEvents } = report

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="glass-panel neon-ring flex max-h-[92vh] w-[520px] max-w-[92vw] flex-col border-4 border-fuchsia-400 bg-[#1c1d3a] p-4 font-mono text-white [@media(min-height:640px)]:p-6">
        <p className="mb-1 shrink-0 text-xs uppercase tracking-widest text-gray-500">Daily Report</p>
        <h2 className="mb-3 shrink-0 text-xl font-bold leading-tight text-fuchsia-300">Day {dayEnded} Complete</h2>

        <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
          {headline && (
            <div className="mb-3 border-2 border-cyan-400/40 bg-cyan-400/10 p-2 text-xs text-cyan-200">
              📰 {headline}
            </div>
          )}

          <div className="mb-3">
            <StatLine label="Cash" delta={cashDelta} formatDelta={(d) => `${d >= 0 ? '+' : '-'}$${Math.abs(d).toLocaleString()}`} />
            <StatLine
              label="Wanted Level"
              delta={wantedDelta}
              neutral
              formatDelta={(d) => (d === 0 ? '±0' : `${d > 0 ? '+' : ''}${d}`)}
            />
            <StatLine
              label="Notoriety"
              delta={notorietyDelta}
              neutral
              formatDelta={(d) => (d === 0 ? '±0' : `${d > 0 ? '+' : ''}${d}`)}
            />
          </div>

          {jailLine && (
            <div className="mb-3 border-2 border-orange-400/50 bg-orange-400/10 p-2 text-xs font-bold text-orange-300">
              🔒 {jailLine}
            </div>
          )}

          {topEvents.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">What Happened</p>
              <div className="flex flex-col gap-2">
                {topEvents.map((e) => (
                  <div key={e.id} className="border-2 border-gray-700 bg-black/20 p-2">
                    <p className="text-xs font-bold text-gray-200">{e.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{e.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-2 text-center text-xs text-gray-500">{daysLeft} day{daysLeft === 1 ? '' : 's'} left.</p>
        </div>

        <div className="mt-4 flex shrink-0 gap-2">
          <button
            onClick={onOpenFeed}
            className="flex-1 border-2 border-gray-600 py-2 text-xs font-bold uppercase tracking-widest text-gray-300 hover:bg-gray-700"
          >
            View Full Feed
          </button>
          <button
            onClick={onClose}
            className="btn-sheen flex-1 border-4 border-fuchsia-400 bg-fuchsia-500 py-2 text-sm font-bold text-black hover:bg-fuchsia-400"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
