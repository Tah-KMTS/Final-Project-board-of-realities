/**
 * Character Portrait Generator — Distinct per-character visual identities.
 * Each historical figure has unique facial features, hair style, skin tone,
 * and signature accessory derived from their real-world appearance.
 */

// Per-character appearance data: skin, hair, hairStyle, suit, tie, hasGlasses,
// hasBeard, facialHairColor, hairLength (short|bald|long|wavy), eyeColor
const APPEARANCE = {
  // Finance Titans
  mansamusa:   { skin:'#7a4f2e', hair:'#111111', suit:'#b8860b', tie:'#ffd700', badge:'👑', label:'14th C Emperor', bald:false, beard:false, glasses:false },
  fugger:      { skin:'#e8c99a', hair:'#c8a870', suit:'#6b2020', tie:'#c0a060', badge:'⚜️', label:'15th C Banker',  bald:false, beard:false, glasses:false },
  rothschild:  { skin:'#e0c090', hair:'#3a3020', suit:'#1b2a50', tie:'#8b6914', badge:'🏦', label:'Dynasty Founder',bald:false, beard:false, glasses:false },
  hamilton:    { skin:'#d4a06a', hair:'#e8e0d0', suit:'#003366', tie:'#990000', badge:'📜', label:'Treasury Architect', bald:false, beard:false, glasses:false },
  vanderbilt:  { skin:'#e8c898', hair:'#e0e0e0', suit:'#3d2510', tie:'#a04020', badge:'🚂', label:'The Commodore', bald:false, beard:true, beardColor:'#cccccc', glasses:false },
  rockefeller: { skin:'#f0d4a0', hair:'#c0c0c0', suit:'#1a1a1a', tie:'#8b0000', badge:'🛢️', label:'Standard Oil',  bald:false, beard:false, glasses:false },
  carnegie:    { skin:'#eeceaa', hair:'#f5f5f5', suit:'#2c1c0c', tie:'#8b4513', badge:'⚙️', label:'Steel Titan',   bald:false, beard:true, beardColor:'#ffffff', glasses:false },
  jpmorgan:    { skin:'#e8c090', hair:'#cccccc', suit:'#0a0a20', tie:'#1a1a8a', badge:'💰', label:'The Banker',    bald:false, beard:true, beardColor:'#999999', glasses:false },
  ford:        { skin:'#f0d090', hair:'#808080', suit:'#2c3e50', tie:'#333333', badge:'🚗', label:'Mass Producer', bald:false, beard:false, glasses:false },
  walker:      { skin:'#4a2c11', hair:'#1a1a1a', suit:'#6a1b9a', tie:'#9c27b0', badge:'💄', label:'Pioneer',       bald:false, beard:false, glasses:false },
  graham:      { skin:'#f0d4a0', hair:'#d0d0d0', suit:'#34495e', tie:'#2c5f8a', badge:'📈', label:'Value Father',  bald:false, beard:false, glasses:true },
  livermore:   { skin:'#e8c090', hair:'#404040', suit:'#111111', tie:'#dc143c', badge:'📉', label:'The Bear',      bald:false, beard:false, glasses:false },
  templeton:   { skin:'#f0d4a0', hair:'#f0f0f0', suit:'#1e3d59', tie:'#2a7f6f', badge:'🌍', label:'Contrarian',   bald:false, beard:false, glasses:true },
  buffett:     { skin:'#f0d4a0', hair:'#e0e0e0', suit:'#333333', tie:'#cc4444', badge:'🥤', label:'Oracle of Omaha',bald:false, beard:false, glasses:true },
  howardmarks: { skin:'#e8c898', hair:'#c0c0c0', suit:'#2a4f4a', tie:'#3a7f6f', badge:'🔄', label:'Cycle Philosopher', bald:false, beard:false, glasses:true },
  munger:      { skin:'#e8c890', hair:'#d8d8d8', suit:'#2c2c54', tie:'#3a3a88', badge:'🧠', label:'Polymath',      bald:false, beard:false, glasses:true },
  lynch:       { skin:'#f0d4a0', hair:'#ffffff', suit:'#27ae60', tie:'#145a32', badge:'🔍', label:'10-Bagger',     bald:false, beard:false, glasses:false },
  soros:       { skin:'#f0d4a0', hair:'#dcdcdc', suit:'#4a154b', tie:'#c0a000', badge:'💷', label:'Reflexive',     bald:false, beard:false, glasses:false },
  dalio:       { skin:'#e8c090', hair:'#a9a9a9', suit:'#2c3e50', tie:'#1a5276', badge:'⚖️', label:'All-Weather',   bald:false, beard:false, glasses:false },
  simons:      { skin:'#f0d4a0', hair:'#ffffff', suit:'#16a085', tie:'#0e6655', badge:'🔢', label:'Medallion',     bald:false, beard:true, beardColor:'#cccccc', glasses:false },
  icahn:       { skin:'#e8c090', hair:'#95a5a6', suit:'#c0392b', tie:'#7b241c', badge:'⚔️', label:'Corporate Raider',bald:false, beard:false, glasses:false },
  jobs:        { skin:'#f0d4a0', hair:'#7f8c8d', suit:'#000000', tie:'none',    badge:'🍎', label:'Design Visionary',bald:false, beard:true, beardColor:'#555555', glasses:false },
  gates:       { skin:'#f0d4a0', hair:'#bdc3c7', suit:'#2980b9', tie:'#1a5276', badge:'💻', label:'Software King', bald:false, beard:false, glasses:true },
  bezos:       { skin:'#f0d4a0', hair:'#f0d4a0', suit:'#2c3e50', tie:'#1a1a1a', badge:'📦', label:'Scale Engine',  bald:true,  beard:false, glasses:false },
  musk:        { skin:'#f0d4a0', hair:'#1a1a1a', suit:'#3f6fd6', tie:'#2040a0', badge:'🚀', label:'Technoking',    bald:false, beard:false, glasses:false },
  huang:       { skin:'#d4956a', hair:'#1a1a1a', suit:'#111111', tie:'#333333', badge:'🧮', label:'AI Architect',  bald:false, beard:false, glasses:false },
  son:         { skin:'#d49060', hair:'#1a1a1a', suit:'#8e44ad', tie:'#6c3483', badge:'📱', label:'Vision Fund',   bald:false, beard:false, glasses:false },

  // Crime Syndicate Members
  capone:      { skin:'#e0ac69', hair:'#1a1a1a', suit:'#1a1a2e', tie:'#8b0000', badge:'🔫', label:'Scarface',      bald:false, beard:false, glasses:false, scar:true },
  nitti:       { skin:'#e0b880', hair:'#222222', suit:'#2a1a1a', tie:'#660000', badge:'🪓', label:'The Enforcer',  bald:false, beard:false, glasses:false },
  ricca:       { skin:'#e8c090', hair:'#333333', suit:'#1c2438', tie:'#4a2000', badge:'🧠', label:'The Brain',     bald:false, beard:false, glasses:true },
  luciano:     { skin:'#f0d4a0', hair:'#333333', suit:'#1b365d', tie:'#b8860b', badge:'👔', label:'The Commission',bald:false, beard:false, glasses:false },
  genovese:    { skin:'#e8c890', hair:'#444444', suit:'#1a1a3e', tie:'#800000', badge:'🕵️', label:'The Don',       bald:false, beard:false, glasses:false },
  costello:    { skin:'#f0d4a0', hair:'#555555', suit:'#2d2d2d', tie:'#2244aa', badge:'🎩', label:'Prime Minister', bald:false, beard:false, glasses:false },
  lansky:      { skin:'#f0d4a0', hair:'#888888', suit:'#111111', tie:'#333333', badge:'💼', label:'Mob Accountant', bald:false, beard:false, glasses:true },
  siegel:      { skin:'#f0d4a0', hair:'#1a1a1a', suit:'#1e1e1e', tie:'#cc0000', badge:'🎲', label:'Bugsy',         bald:false, beard:false, glasses:false },
  cohen:       { skin:'#e8c890', hair:'#222222', suit:'#222244', tie:'#884400', badge:'🎰', label:'West Coast Capo',bald:false, beard:false, glasses:false },
  escobar:     { skin:'#b07040', hair:'#1a1a1a', suit:'#8b0000', tie:'#4a0000', badge:'🌿', label:'El Patron',     bald:false, beard:true, beardColor:'#222222', glasses:false },
  gaviria:     { skin:'#b86828', hair:'#222222', suit:'#2a1000', tie:'#660000', badge:'🗡️', label:'The Strategist', bald:false, beard:false, glasses:false },
  ochoa:       { skin:'#c07840', hair:'#333333', suit:'#1a2010', tie:'#224422', badge:'🚢', label:'The Financier', bald:false, beard:false, glasses:false },
  blanco:      { skin:'#b07040', hair:'#1a1a1a', suit:'#4a1f6a', tie:'#8b1a8b', badge:'🕷️', label:'Black Widow',  bald:false, beard:false, glasses:false },
  osvaldo:     { skin:'#b07848', hair:'#222222', suit:'#2a1050', tie:'#440088', badge:'👑', label:'Cartel Prince', bald:false, beard:false, glasses:false },
  dixon:       { skin:'#b88050', hair:'#333333', suit:'#1a0828', tie:'#6600aa', badge:'🌃', label:'Nightlife Capo',bald:false, beard:false, glasses:false },
  lepke:       { skin:'#d0c0a0', hair:'#1a1a1a', suit:'#1c1c1c', tie:'#555555', badge:'🔪', label:'The Extortionist',bald:false, beard:false, glasses:false },
  anastasia:   { skin:'#d4b890', hair:'#222222', suit:'#111111', tie:'#cc0000', badge:'💀', label:'Lord Executioner',bald:false, beard:false, glasses:false },
  weiss:       { skin:'#d8c0a0', hair:'#333333', suit:'#0a0a0a', tie:'#888800', badge:'🎯', label:'Hit Leader',    bald:false, beard:false, glasses:false },
  rothstein:   { skin:'#f0d4a0', hair:'#dddddd', suit:'#3b2f2f', tie:'#446622', badge:'🃏', label:'The Brain',     bald:false, beard:false, glasses:false },
  waxey:       { skin:'#e8c890', hair:'#444444', suit:'#2c2c2c', tie:'#884422', badge:'🍾', label:'Rum Runner',    bald:false, beard:false, glasses:false },
  remus:       { skin:'#f0d090', hair:'#888888', suit:'#2a2010', tie:'#6b4226', badge:'🥃', label:'Bootleg King',  bald:false, beard:false, glasses:false },

  // US Presidents
  washington:  { skin:'#e8c898', hair:'#f0f0f0', suit:'#1a3a5c', tie:'#aa2222', badge:'🦅', label:'1st President', bald:false, beard:false, glasses:false },
  lincoln:     { skin:'#d4a870', hair:'#1a1a1a', suit:'#1a1a1a', tie:'#333333', badge:'🎩', label:'16th President', bald:false, beard:true, beardColor:'#222222', glasses:false },
  fdr:         { skin:'#e8c898', hair:'#c0c0c0', suit:'#1e3a5c', tie:'#aa3311', badge:'🦽', label:'32nd President', bald:false, beard:false, glasses:false },
  jfk:         { skin:'#e0c090', hair:'#8a6240', suit:'#1a2840', tie:'#cc4444', badge:'☀️', label:'35th President', bald:false, beard:false, glasses:false },
  reagan:      { skin:'#e8c898', hair:'#1a1a1a', suit:'#222244', tie:'#cc2222', badge:'🎬', label:'40th President', bald:false, beard:false, glasses:false },
  tr:          { skin:'#e0c080', hair:'#8a7050', suit:'#2c1c0c', tie:'#aa4422', badge:'🦁', label:'26th President', bald:false, beard:false, glasses:true, mustache:true },
  jefferson:   { skin:'#e8c898', hair:'#c89060', suit:'#8b2500', tie:'#cc6600', badge:'📰', label:'3rd President',  bald:false, beard:false, glasses:false },
  eisenhower:  { skin:'#e0c090', hair:'#e0e0e0', suit:'#1e3040', tie:'#224488', badge:'⭐', label:'34th President', bald:true,  beard:false, glasses:false },
  obama:       { skin:'#5a3822', hair:'#1a1a1a', suit:'#1a2040', tie:'#bb3322', badge:'🇺🇸', label:'44th President', bald:false, beard:false, glasses:false },
  clinton:     { skin:'#e8c898', hair:'#e0e0e0', suit:'#1a2a4a', tie:'#6633cc', badge:'🎷', label:'42nd President', bald:false, beard:false, glasses:false },

  // Federal Reserve Chairmen
  volcker:     { skin:'#e0c0a0', hair:'#c8c8c8', suit:'#1a2234', tie:'#334477', badge:'📊', label:'Inflation Slayer', bald:false, beard:false, glasses:false },
  greenspan:   { skin:'#e8c898', hair:'#d0d0d0', suit:'#263040', tie:'#445566', badge:'🎻', label:'The Maestro',     bald:false, beard:false, glasses:true },
  bernanke:    { skin:'#e8c898', hair:'#c0c0c0', suit:'#1e2a3a', tie:'#558833', badge:'🚁', label:'Helicopter Ben',  bald:false, beard:true, beardColor:'#999999', glasses:false },
  yellen:      { skin:'#e8c898', hair:'#e0d8c0', suit:'#2a3050', tie:'none',    badge:'📉', label:'Dovish Architect', bald:false, beard:false, glasses:false },
  powell:      { skin:'#e8c898', hair:'#d0d0d0', suit:'#1c2030', tie:'#443366', badge:'📡', label:'Data-Dependent',  bald:false, beard:false, glasses:false },
  eccles:      { skin:'#e8c090', hair:'#bbbbbb', suit:'#1a2030', tie:'#2a4a6a', badge:'🏛️', label:'Stimulus Founder',bald:false, beard:false, glasses:false },
  martin:      { skin:'#e0c090', hair:'#c8c8c8', suit:'#1e2c3e', tie:'#3a5560', badge:'🥃', label:'Punch Bowl',      bald:false, beard:false, glasses:false },
  burns:       { skin:'#e8c090', hair:'#c0c0c0', suit:'#1c2438', tie:'#5a4030', badge:'🖊️', label:'Easy Credit',     bald:false, beard:false, glasses:true },
  miller:      { skin:'#e0c090', hair:'#aaaaaa', suit:'#202830', tie:'#445544', badge:'📋', label:'Rate Watcher',    bald:false, beard:false, glasses:false },
  meyer:       { skin:'#e0c090', hair:'#d0d0d0', suit:'#1a2234', tie:'#5a3020', badge:'🏅', label:'Liquidity Guard', bald:false, beard:false, glasses:false },

  // FTC Chairmen
  khan:        { skin:'#c07848', hair:'#1a1a1a', suit:'#1e2a3e', tie:'none',    badge:'⚖️', label:'Trust-Buster',   bald:false, beard:false, glasses:false },
  ramirez:     { skin:'#b87040', hair:'#1a1a1a', suit:'#2a1e3e', tie:'none',    badge:'🔒', label:'Privacy Chair',  bald:false, beard:false, glasses:false },
  simons_ftc:  { skin:'#e0c090', hair:'#888888', suit:'#1c2438', tie:'#334477', badge:'🖥️', label:'Platform Chair', bald:false, beard:false, glasses:false },
  muris:       { skin:'#e0c090', hair:'#aaaaaa', suit:'#1a2040', tie:'#335544', badge:'🔦', label:'Fraud Enforcer', bald:false, beard:false, glasses:false },
  pertschuk:   { skin:'#e0c090', hair:'#cccccc', suit:'#1e2838', tie:'#442244', badge:'🛡️', label:'Consumer Pioneer',bald:false, beard:false, glasses:false },
  kirkpatrick: { skin:'#e0c090', hair:'#b0b0b0', suit:'#1a2030', tie:'#224422', badge:'🔍', label:'Disclosure Chair',bald:false, beard:false, glasses:false },
  kovacic:     { skin:'#e0c090', hair:'#909090', suit:'#1c2434', tie:'#444422', badge:'🌐', label:'Global Enforcer', bald:false, beard:false, glasses:false },
  majoras:     { skin:'#e8c898', hair:'#b8a080', suit:'#2a1e3a', tie:'none',    badge:'🔄', label:'Merger Chair',   bald:false, beard:false, glasses:false },
  leibowitz:   { skin:'#e0c090', hair:'#888888', suit:'#1a2234', tie:'#442244', badge:'💊', label:'Pharma Chair',   bald:false, beard:false, glasses:false },
  pitofsky:    { skin:'#e0c090', hair:'#cccccc', suit:'#1e2838', tie:'#334455', badge:'📐', label:'Vertical Chair', bald:false, beard:false, glasses:true },
}

// Overworld sprite palette derived from the same APPEARANCE data the
// portraits use (suit maps to outfit), so a character's walking sprite and
// dialogue portrait agree on colors. Rosters without their own palette field
// (presidents, fed/ftc chairmen, agency heads) get theirs from here.
export function getCharacterSpritePalette(npcId) {
  const app = APPEARANCE[npcId]
  if (!app) return null
  return { skin: app.skin, hair: app.hair, outfit: app.suit }
}

export function getCharacterPortrait(npcId) {
  const app = APPEARANCE[npcId] || APPEARANCE['graham']
  const {
    skin, hair, suit, tie, badge, label,
    bald, beard, beardColor, glasses, scar, mustache,
  } = app

  const hairPath = bald
    ? ''
    : `<path d="M 38 42 Q 60 18 82 42 Q 78 24 60 22 Q 42 24 38 42 Z" fill="${hair}"/>`

  const glassesEl = glasses
    ? `<rect x="43" y="40" width="13" height="9" rx="2" fill="none" stroke="#aaaaaa" stroke-width="1.8"/>
       <rect x="62" y="40" width="13" height="9" rx="2" fill="none" stroke="#aaaaaa" stroke-width="1.8"/>
       <line x1="56" y1="44" x2="62" y2="44" stroke="#aaaaaa" stroke-width="1.8"/>`
    : ''

  const beardEl = beard
    ? `<ellipse cx="60" cy="62" rx="14" ry="8" fill="${beardColor || hair}" opacity="0.9"/>`
    : ''

  const mustacheEl = mustache
    ? `<path d="M 50 56 Q 60 60 70 56" stroke="${beardColor || hair}" stroke-width="3" fill="none"/>`
    : ''

  const scarEl = scar
    ? `<line x1="68" y1="38" x2="74" y2="54" stroke="#8b0000" stroke-width="1.5" opacity="0.8"/>`
    : ''

  const tieEl = tie !== 'none'
    ? `<path d="M 57 80 L 60 110 L 63 80 Z" fill="${tie}"/>
       <path d="M 56 79 L 57 88 L 60 85 L 63 88 L 64 79 Z" fill="${tie}"/>`
    : ''

  // Badge circle bottom-right corner
  const badgeEl = `<circle cx="100" cy="100" r="16" fill="#0f172a" stroke="#38bdf8" stroke-width="1.5"/>
    <text x="100" y="106" text-anchor="middle" font-size="14">${badge}</text>`

  // Skin tone variants for diverse representation
  const headFill = skin

  const svgData = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <radialGradient id="bg${npcId}" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0a0f1e"/>
      </radialGradient>
    </defs>
    <rect width="120" height="120" rx="12" fill="url(#bg${npcId})" stroke="#38bdf8" stroke-width="1.5"/>
    <!-- Suit/Body -->
    <path d="M 16 120 Q 60 80 104 120 L 104 120 L 16 120 Z" fill="${suit}"/>
    <!-- Shirt white collar -->
    <path d="M 50 80 L 60 112 L 70 80 Z" fill="#e8e8e8"/>
    ${tieEl}
    <!-- Neck -->
    <rect x="52" y="65" width="16" height="14" rx="3" fill="${headFill}"/>
    <!-- Head -->
    <ellipse cx="60" cy="47" rx="22" ry="24" fill="${headFill}"/>
    <!-- Hair -->
    ${hairPath}
    <!-- Ears -->
    <ellipse cx="38" cy="48" rx="4" ry="5" fill="${headFill}"/>
    <ellipse cx="82" cy="48" rx="4" ry="5" fill="${headFill}"/>
    <!-- Eyes -->
    <ellipse cx="51" cy="44" rx="3.5" ry="3" fill="#e8f4f8"/>
    <ellipse cx="69" cy="44" rx="3.5" ry="3" fill="#e8f4f8"/>
    <circle cx="51" cy="44" r="2" fill="#1a1a2e"/>
    <circle cx="69" cy="44" r="2" fill="#1a1a2e"/>
    <!-- Eyebrows -->
    <path d="M 46 39 Q 51 37 56 39" stroke="${hair}" stroke-width="1.8" fill="none"/>
    <path d="M 64 39 Q 69 37 74 39" stroke="${hair}" stroke-width="1.8" fill="none"/>
    <!-- Nose -->
    <path d="M 58 47 Q 57 53 60 54 Q 63 53 62 47" stroke="#00000033" stroke-width="1" fill="none"/>
    <!-- Mouth -->
    <path d="M 53 58 Q 60 62 67 58" stroke="#00000055" stroke-width="1.5" fill="none"/>
    ${glassesEl}
    ${beardEl}
    ${mustacheEl}
    ${scarEl}
    ${badgeEl}
    <!-- Name label -->
    <rect x="0" y="106" width="120" height="14" rx="0" fill="#0f172a" opacity="0.85"/>
    <text x="60" y="116" text-anchor="middle" font-size="8" fill="#94a3b8" font-family="monospace">${label}</text>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgData)}`
}
