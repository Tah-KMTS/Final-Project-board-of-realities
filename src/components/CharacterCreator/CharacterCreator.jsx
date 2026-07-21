import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import {
  SKIN_TONES,
  HAIR_COLORS,
  OUTFIT_COLORS,
  FACE_OPTIONS,
  EYEBROW_OPTIONS,
  EYE_OPTIONS,
  MOUTH_OPTIONS,
  NOSE_OPTIONS,
  HAIR_OPTIONS,
} from '../../game/characterPalettes'

function Selector({ label, options, value, onChange, renderOption }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-700 py-2">
      <span className="w-28 text-sm text-gray-300">{label}</span>
      <button
        onClick={() => onChange((value - 1 + options.length) % options.length)}
        className="px-2 text-yellow-300 hover:text-yellow-100"
      >
        ◀
      </button>
      <div className="flex-1 text-center text-sm">
        {renderOption ? renderOption(options[value]) : options[value]}
      </div>
      <button
        onClick={() => onChange((value + 1) % options.length)}
        className="px-2 text-yellow-300 hover:text-yellow-100"
      >
        ▶
      </button>
    </div>
  )
}

function ColorSwatch({ color }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span className="inline-block h-5 w-5 border border-gray-500" style={{ backgroundColor: color }} />
      <span>{color}</span>
    </div>
  )
}

export default function CharacterCreator() {
  const startNewGame = useGameStore((s) => s.startNewGame)
  const [name, setName] = useState('')
  const [gender, setGender] = useState('male')
  const [face, setFace] = useState(0)
  const [skinTone, setSkinTone] = useState(0)
  const [eyebrows, setEyebrows] = useState(0)
  const [eyes, setEyes] = useState(0)
  const [mouth, setMouth] = useState(0)
  const [nose, setNose] = useState(0)
  const [hair, setHair] = useState(0)
  const [outfitColor, setOutfitColor] = useState(0)

  const handleConfirm = () => {
    startNewGame({
      name: name.trim() || 'Adventurer',
      gender,
      face,
      skinTone,
      eyebrows,
      eyes,
      mouth,
      nose,
      hair,
      outfitColor,
    })
  }

  const previewSkin = SKIN_TONES[skinTone]
  const previewHair = HAIR_COLORS[hair % HAIR_COLORS.length]
  const previewOutfit = OUTFIT_COLORS[outfitColor]

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0f1020] font-mono text-white">
      <div className="flex gap-10 border-4 border-yellow-300 bg-[#1c1d3a] p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="text-sm text-gray-400">PREVIEW</div>
          <svg width="120" height="160" viewBox="0 0 120 160">
            <ellipse cx="60" cy="55" rx="30" ry="32" fill={previewSkin} />
            <path
              d={
                HAIR_OPTIONS[hair] === 'Long'
                  ? 'M30 45 Q60 5 90 45 L92 90 L86 60 Q60 40 34 60 L28 90 Z'
                  : HAIR_OPTIONS[hair] === 'Spiky'
                  ? 'M30 45 L40 10 L48 40 L60 5 L72 40 L80 10 L90 45 Z'
                  : 'M30 45 Q60 10 90 45 L88 30 Q60 15 32 30 Z'
              }
              fill={previewHair}
            />
            <rect x="60" y="90" width="0" height="0" />
            <rect x="30" y="95" width="60" height="55" fill={previewOutfit} />
            <circle cx="48" cy="52" r="3" fill="#222" />
            <circle cx="72" cy="52" r="3" fill="#222" />
            <path d="M45 68 Q60 76 75 68" stroke="#7a3b2e" strokeWidth="2" fill="none" />
          </svg>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Character Name"
            maxLength={16}
            className="w-full border-2 border-gray-600 bg-[#0f1020] px-2 py-1 text-center text-white"
          />
          <div className="flex gap-2">
            {['male', 'female'].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`border-2 px-3 py-1 text-xs uppercase ${
                  gender === g ? 'border-yellow-300 bg-yellow-300 text-black' : 'border-gray-600'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="w-96">
          <h2 className="mb-3 text-xl font-bold text-yellow-300">Character Creator</h2>
          <Selector label="Face" options={FACE_OPTIONS} value={face} onChange={setFace} />
          <Selector
            label="Skin Tone"
            options={SKIN_TONES}
            value={skinTone}
            onChange={setSkinTone}
            renderOption={(c) => <ColorSwatch color={c} />}
          />
          <Selector label="Eyebrows" options={EYEBROW_OPTIONS} value={eyebrows} onChange={setEyebrows} />
          <Selector label="Eyes" options={EYE_OPTIONS} value={eyes} onChange={setEyes} />
          <Selector label="Mouth" options={MOUTH_OPTIONS} value={mouth} onChange={setMouth} />
          <Selector label="Nose" options={NOSE_OPTIONS} value={nose} onChange={setNose} />
          <Selector label="Hair Style" options={HAIR_OPTIONS} value={hair} onChange={setHair} />
          <Selector
            label="Outfit Color"
            options={OUTFIT_COLORS}
            value={outfitColor}
            onChange={setOutfitColor}
            renderOption={(c) => <ColorSwatch color={c} />}
          />

          <button
            onClick={handleConfirm}
            className="mt-6 w-full border-4 border-green-400 bg-green-500 py-3 text-lg font-bold text-black hover:bg-green-400"
          >
            Confirm & Roll Dice
          </button>
        </div>
      </div>
    </div>
  )
}
