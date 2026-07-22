# Solo Leveling reference — for Hunter World (world 1) redesign

Design-reference summary only (mechanics/lore concepts in our own words, not reproduced text), for use by the Hunter-region world-building and combat-rework passes.

## World-building concepts

- **Gates**: sudden rifts/portals connecting the real world to dungeons full of monsters. They appear unpredictably at real-world locations and must be cleared or sealed by licensed Hunters. This game's existing "Rift" concept already maps directly onto this.
- **Dungeons**: the space inside a Gate — a self-contained area with waves of monsters culminating in a boss. Clearing the boss closes the Gate.
- **Double Dungeon**: a rare, extremely dangerous variant — a dungeon hidden inside another dungeon, far above the outer dungeon's apparent rank, that can trap a raid party who thought they were tackling something much easier. Good template for a rare "this looks like a low-rank rift but isn't" encounter.
- **Red Gate**: a Gate that seals shut once hunters enter, trapping them inside until every monster is cleared or they die — no early retreat. Good template for a raised-stakes rift variant.
- **Hunter ranks**: E through S, in ascending power (this game already has `hunterRank` E→S — consistent, keep it).
- **Hunter Association**: the licensing/regulatory body for Hunters; assigns rank, tracks kills, dispatches raid parties to Gates. This game already has a Hunter Association HQ — consistent.
- **Guilds**: Hunters organize into guilds for resources, shared raids, and protection; top guilds hold significant political/financial power.
- **Monarchs and Rulers**: two opposing factions of god-tier beings from which the strongest "Rulers" (agents of order) and "Monarchs" (rulers of ruin, each commanding an army of their own species/type) draw their power. The central late-game conflict is Monarchs vs. Rulers, fought through human proxies (Hunters empowered/possessed or chosen by one side).
- **Shadow Monarch**: the strongest of the Monarchs, ruler of the army of the dead — a hidden, ascension-tier identity a Hunter can awaken into after enough growth, rather than a rank you're born with. This game's existing hidden `shadow_monarch` profession with unlock conditions is already exactly this pattern — keep it, just make sure it reads as an *ascension* (something you grow into) rather than a starting class choice.

## Combat/power system concepts

- **The System**: an interface only the protagonist (and eventually other awakened players) can see — quest log, stat sheet, level-up notifications, skill acquisition. Mechanically this is just an RPG stat/quest system with in-fiction justification. This game's existing Zustand store + rank/stat state already serves this role; leaning into "the System" as flavor text/UI framing (quest popups, level-up banners) would sell the reference without new mechanics.
- **Stats**: Strength, Agility, Perception, Vitality, Intelligence — allocated on level-up. This game's base-5-stats-at-start pattern (per the earlier balance review) maps cleanly onto this if the same stat names are used.
- **Daily Quest**: a punishing, mandatory training regimen (physical conditioning + combat drills) that a newly-awakened low-rank Hunter is forced to complete daily, with escalating stat rewards for compliance and steep penalties for skipping. Good template for an optional daily-grind side-loop that rewards consistent play.
- **Arise (extraction)**: after killing certain monsters, the Shadow Monarch can "extract" the corpse, resurrecting it as a loyal Shadow Soldier that fights on command from then on, retaining a fraction of its former power and growing stronger as its master levels. This is the mechanic to build the "real battle, not one monster" ask around: a rift clear could let the player permanently recruit one or more defeated monsters into a standing Shadow Army, deployable in future fights instead of fighting solo every time.
- **Shadow Army hierarchy**: extracted shadows aren't identical — some are rank-and-file soldiers, some are elite named generals with their own personality and specialized combat roles (a knight-type built for dueling, a beast-type built for scouting/speed, a giant tank-type built for absorbing damage, etc.). A small roster of named shadow-general archetypes (rather than one generic "shadow" unit) would give the army-building loop more texture without inventing an unbounded number of units.
- **Rift/dungeon combat shape**: fights are rarely one monster — they're waves (mook-tier monsters in groups) building up to a named boss with a clearly telegraphed higher power budget, sometimes with an environmental hazard specific to that dungeon's theme. This directly answers "it's supposed to be fighting monsters in a rift, not just one monster."

## How this maps onto the existing codebase

- `RiftCombatModal.jsx`'s `{onClose, onVictory, onDefeat}` contract can stay as the container, but the fight itself becomes multi-stage: N waves of weaker monsters → a boss, instead of one single monster per rift.
- `hunterRank` E→S and the hidden `shadow_monarch` profession are already correctly Solo-Leveling-shaped — the redesign should deepen them, not replace them.
- A Shadow Army roster (a handful of named extractable generals + generic rank-and-file shadows) is new state that would need to live in `world1` in the store, plus new UI to view/deploy the army in combat.
- Gate/dungeon variants (Double Dungeon, Red Gate) map onto "special rift" encounter types layered on top of the existing rift-difficulty system, not a replacement for it.
