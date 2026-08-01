import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { askGuide } from './aiGuide'

// Aria's avatar - an original stylized idol-styled face, drawn from scratch
// (star hair clip, two-tone hair, simple round features) rather than
// referencing any real performer's likeness. Same "original character, not
// a real-person reference" posture as PhoneMascot in PhoneShell.jsx.
function AriaAvatar({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <circle cx="20" cy="20" r="19" fill="#1c1230" stroke="#f472b6" strokeWidth="1.2" />
      {/* Hair back */}
      <path d="M6 18 Q6 4 20 4 Q34 4 34 18 L34 24 Q27 20 20 24 Q13 20 6 24 Z" fill="#a78bfa" />
      {/* Face */}
      <ellipse cx="20" cy="21" rx="10.5" ry="11" fill="#fbcfe8" />
      {/* Hair front fringe */}
      <path d="M9.5 17 Q13 12 20 13 Q27 12 30.5 17 Q27 15 20 16 Q13 15 9.5 17 Z" fill="#f472b6" />
      {/* Eyes */}
      <circle cx="15.5" cy="22" r="1.6" fill="#1c1230" />
      <circle cx="24.5" cy="22" r="1.6" fill="#1c1230" />
      {/* Smile */}
      <path d="M16 27 Q20 30 24 27" stroke="#1c1230" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Star hair clip */}
      <path d="M29 9 L30 11.2 L32.4 11.5 L30.6 13.1 L31.1 15.5 L29 14.2 L26.9 15.5 L27.4 13.1 L25.6 11.5 L28 11.2 Z" fill="#22d3ee" />
    </svg>
  )
}

const STARTER_PROMPTS = [
  'How do I win?',
  'What happens if I get arrested?',
  'What can I do at the Bank?',
]

// Phone's Guide app - an in-game AI helper for "what can I do / how does X
// work" questions, answered by Aria (see aiGuide.js for the API call this
// wraps - same OpenAI Responses integration pattern as
// src/features/finance/aiNarrator.js). Stateless per question (no
// conversation-history threading into the API context) - each question gets
// a fresh answer grounded in aiGuide.js's own game-reference system prompt,
// same simplicity as every other LLM call in this project.
export default function GuideApp() {
  const [messages, setMessages] = useState([
    { role: 'aria', text: "Hi, I'm Aria! Ask me anything about how the game works - the economy, crime, the phone, all of it." },
  ])
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, asking])

  const sendQuestion = async (question) => {
    const trimmed = question.trim()
    if (!trimmed || asking) return
    setMessages((prev) => [...prev, { role: 'player', text: trimmed }])
    setInput('')
    setAsking(true)
    const answer = await askGuide(trimmed)
    setMessages((prev) => [...prev, { role: 'aria', text: answer }])
    setAsking(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <AriaAvatar />
        <div>
          <div className="text-sm font-bold text-pink-300">Aria</div>
          <div className="text-[10px] text-gray-500">Your in-game guide</div>
        </div>
      </div>

      <div ref={scrollRef} className="mb-2 flex-1 space-y-2 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'player' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'aria' && <AriaAvatar size={22} />}
            <div
              className={`ml-1.5 max-w-[78%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
                m.role === 'player'
                  ? 'bg-cyan-500/20 text-cyan-100'
                  : 'bg-pink-950/30 text-pink-50'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {asking && (
          <div className="flex justify-start">
            <AriaAvatar size={22} />
            <div className="ml-1.5 rounded-lg bg-pink-950/30 px-2.5 py-1.5 text-xs italic text-pink-200/70">
              Aria is thinking…
            </div>
          </div>
        )}
      </div>

      {messages.length === 1 && (
        <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendQuestion(p)}
              className="rounded-full border border-pink-500/40 px-2.5 py-1 text-[10px] font-bold text-pink-300 hover:bg-pink-500/10"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendQuestion(input)}
          disabled={asking}
          placeholder="Ask Aria something..."
          className="min-w-0 flex-1 rounded border border-gray-600 bg-black px-2 py-1.5 text-xs text-white disabled:opacity-50"
        />
        <button
          onClick={() => sendQuestion(input)}
          disabled={asking || !input.trim()}
          className="shrink-0 rounded border border-pink-400 p-1.5 text-pink-300 hover:bg-pink-400 hover:text-black disabled:opacity-30"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
