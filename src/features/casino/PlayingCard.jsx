import { isRed } from './playingCards'

// A single playing card, drawn entirely with CSS/Tailwind (no image assets,
// per the project's no-external-art rule) - a bordered div with the rank
// twice (corner pips) and the suit glyph centered.
export default function PlayingCard({ card, faceDown, small }) {
  const sizeClass = small ? 'h-16 w-11 text-xs' : 'h-24 w-16 text-sm'

  if (faceDown || !card) {
    return (
      <div
        className={`${sizeClass} flex items-center justify-center rounded border-2 border-gray-400 bg-gradient-to-br from-indigo-900 to-purple-900 bg-[length:8px_8px]`}
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 4px, transparent 4px 8px)' }}
      >
        <span className="text-lg">🂠</span>
      </div>
    )
  }

  const red = isRed(card)
  return (
    <div
      className={`${sizeClass} relative flex flex-col justify-between rounded border-2 border-gray-300 bg-white px-1 py-0.5 font-bold ${
        red ? 'text-red-600' : 'text-gray-900'
      }`}
    >
      <span>{card.rank}</span>
      <span className="self-center text-lg leading-none">{card.suit}</span>
      <span className="self-end rotate-180">{card.rank}</span>
    </div>
  )
}
