# Board of Realities — World Bible

Lightweight, living reference. One paragraph per faction/NPC/rule. Update
this file whenever a shipped feature adds or changes lore; do not let it
drift from `src/`. Source-grounded as of the current `src/features/*`,
`src/utils/npcGenerator.js`, and `src/game/scenes/*WorldScene.js`.

**Meta layer note:** the game is framed as a 3-world RPG (Hunter,
Financial Anarchy, Yu-Gi-Oh/DDM), but the shipped `BLOCKS` array
(`src/store/useGameStore.js`) actually defines **four** dice-selectable
blocks: `hunter` ("The Hunter's Rift"), `finance` ("Financial Anarchy"),
`yugioh` ("King of Games"), and `domino` ("Domino City"). The latter two
are both Yu-Gi-Oh-flavored but are separately implemented worlds with
their own scenes, state slices, and NPC data — see the Yu-Gi-Oh section
below for the contradiction this creates.

---

## Hunter World ("The Hunter's Rift")

**Tone/rules:** Gritty procedural crime-city with an isekai power-fantasy
seam (Solo Leveling / Overlord pastiche). Player rolls a starting
profession (Fighter/Mage/Assassin/Tank/Healer, weighted) and climbs Hunter
ranks E→D→C→B→A→S by EXP. A hidden, unrollable `shadow_monarch` profession
(0 spawn weight) can be unlocked mid-run: one of four conditions
(flawless 3-rift streak, 50 monsters killed, survive 5 turns at ≤5% HP, or
reach C-rank without ever shopping) is chosen at random per playthrough
and never revealed to the player — pure discovery-driven secret class.
Wanted Level system: robbing bystanders (R key) raises it; police spawn
and escalate encounters when it's above 0.

**Key locations:** Hunter Association HQ (stat allocation, rank/profession
readout, Final Raid gate), Supermarket, Burger Joint, Guild Dorms
(decorative), two Dimensional Rifts (`riftA` diff 3, `riftB` diff 7).

**Key NPCs:** Unnamed marriage candidate ("???", met via `FamilyModal`,
first-meet/return dialogue, can marry and have children) — reuses the
exact palette (skin #f1c27d, hair #8b0000 (dark red), outfit #7a2fd6
(purple), Long hair) that the Yu-Gi-Oh world's Cynn uses; likely
coincidental asset reuse rather than the same character, but flagging
since both are mysterious purple-and-red female NPCs. Poom — gruff
trainer NPC, gates a real-webcam squat-tracking minigame (MediaPipe pose
detection, 15 full-depth reps) rewarding either the Used Tampon or Weird
Umbrella item. Tan — mini-golf NPC (separate quest, `MiniGolfModal`).

**Win condition:** "Final Raid" unlocks when ALL of: S-Rank, married,
$1,000,000 cash, ≥1 child, and possession of the "Spring of Nazarick"
item are true.

**Open mysteries:** Which Shadow Monarch condition is active is
intentionally hidden per-playthrough — not a bug, a design feature.

---

## Financial Anarchy (Finance World)

**Tone/rules:** Satirical high-stakes finance/GTA hybrid. Real historical
and modern tycoons appear as essentially killable/robbable boss NPCs:
**Warren Biffle** ("The Oracle," $100B net worth, bodyguard power 6),
**Cornelius Vanderbilt** ("The Commodore," $200B, power 8), **Elan Rusk**
("The Disruptor," $250B, power 10). Each has scaled bodyguard-squad combat
stats generated from `netWorth`/`bodyguardPower`. Player options against
them: work for them (safe +$300), collude on insider trading (+$2,000,
Wanted +1), mug (+$1,500, Wanted +2), extort (+$5,000, Wanted +3), or
attempt to kill them outright (fight bodyguards; death is permanent,
tracked via `world2.npcStatus`). Wanted Level escalates to SWAT, then FBI
Tactical Units at wanted level ≥4.

**Key locations:** Stock Exchange, Bank & Realty Office, Corporate
Holdings, Crypto Exchange, plus each tycoon's namesake tower.

**Systems:** Stocks/portfolio, real estate, company ownership, and a
crypto market with a "Hype Meter" — buying and then "Shill It On Social
Media" pumps price/hype, higher hype = higher crash risk (the pump-and-
dump loop). Win condition: net worth ≥ `NET_WORTH_WIN_TARGET`
(`financeNetWorthWinMet`).

**Open mysteries:** None found; this world's satire is broad rather than
plot-driven. Worth keeping an eye on: using real public figures' names as
literal, killable characters is a tone/legal choice, not a lore
inconsistency — flagging for awareness, not asking for a change.

---

## Yu-Gi-Oh / DDM World — two parallel implementations (see contradiction below)

### "King of Games" (block `yugioh`, `YugiohWorldScene`, state slice `world3`)

**Tone/rules:** Card-game bravado, open free-roam Domino City (plaza +
fountain layout, explicitly built to read as structurally distinct from
Hunter's Rift). Duels resolve via the DDM (Dungeon Dice Monsters) board,
not the TCG. Beating Yugi at literally any game of chance (coin toss,
dice, sprint via `ChallengeModal`) is sufficient to make him forfeit and
clear the whole world — deliberately gamified/absurd win condition
matching the world's tone.

**Key NPCs:** Muto Yugi (Kame Game Shop; has a "Heart of the Cards" that
weakens — `yugiBrokenHeart` — once Téa marries the player), Seto Kaiba
(KaibaCorp Tower; sells the company outright to the player for $3,000,000
via `buyKaibaCorp`, after which the player can cheat mid-duel), Joey
Wheeler, Tristan Taylor, Solomon Muto (all kidnappable, +3 Wanted, used as
hostage leverage against Yugi in a "Rescue Duel"), Téa Gardner (romance
track via relationship meter, marriageable at 100%), Duke Devlin. **Tah**
— original (non-canon) character, red outfit, wandering NPC and also a
standalone high-stakes betting encounter (random $3–8k wager DDM duel,
rare 15%-chance RPS veto that if won awards "Tah the Tyrant," a loot-
hoarding AI companion item). **Cynn** — original character, Tah's sister,
purple-haired wanderer who plays a "Faux-Disney" DDM deck.

**Established branching chain — Cynn → Tah's intervention**
(`CynnEncounterModal.jsx`): challenging Cynn to DDM has two outcomes.
(1) Player beats Cynn → she reacts angry or starts stalking (50/50) →
Tah "always knows when his sister plays," appears furious, and forces an
immediate DDM duel (Chaos Deck, +2 power bonus) with no way to decline;
losing costs $500. (2) Player loses to Cynn → she takes $200 and wanders
off → Tah is intrigued ("She lost? Interesting") and challenges the
player himself with a randomized Prehistoric Deck, but here the player
*can* invoke a Rock-Paper-Scissors veto: winning it makes Tah back off
with no forfeit; losing forces the Prehistoric duel, and losing *that*
removes a random card from the player's deck permanently.

**Open mysteries:** Nothing unresolved by design here — Cynn/Tah's
sibling relationship and motives are established, if thin.

### "Domino City" (block `domino`, `DominoWorldScene`, state slice `world4`)

**Tone/rules:** A day/time-block life-sim structure (day 1–7 Mon–Sun,
time-block 1=Morning..4=Night), zone-switching star-topology map
(Player's Room, Streets, Kame Shop, Domino Park, Town Square, KC Tower),
DP (Duel Points) currency economy with a starter deck, trunk, deck
builder, and purchasable tournament pass.

**Key NPCs (`NPC_ROSTER`):** Seto Kaiba (Tier 5, Blue-Eyes/Aggro, only
spawns Sunday evenings/night at KC Tower), Joey Wheeler (Tier 4,
Red-Eyes/Luck, MWF afternoons at Domino Park), Muto Yugi (Tier 5, Dark
Magician/Balanced, weekday mornings-evenings at Kame Shop), Solomon Muto
(Tier 2, weekend mornings at Kame Shop), Téa Gardner (Tier 2, Tue/Thu
afternoon-evening at Town Square), Duke Devlin (Tier 3, Wed/Sat at the
Streets), plus a generic Tier-1 "Street Duelist" (always available,
Streets). Each has pre/win/loss dialogue and DP payout scaled by tier
(with quick-victory/flawless bonuses).

**Contradiction to flag:** `world3` and `world4` both feature Yugi, Kaiba,
Joey, Téa, and Solomon as named characters, but as two entirely
independent, non-synced data sets and state slices — no shared
relationship, ownership, or defeat state between them. A player can marry
Téa and own KaibaCorp in "King of Games," while "Domino City"'s Téa and
Kaiba behave as untouched strangers running a duel-schedule, with no
narrative acknowledgment that they're (presumably) the same people. This
reads as either (a) two separate blocks that happen to share a cast by
coincidence of both being Yu-Gi-Oh-themed reference points on the board,
or (b) an unintentional duplication that should either be merged into one
world/state slice or explicitly retconned as different pocket-dimension
versions of Domino City. **This needs an explicit call: intentional
parallel-universe retcon, or should `world4`'s roster reference/inherit
`world3`'s relationship flags?**

---

## Underworld / Crime Syndicates (Finance World)

**Canon roster:** `src/data/syndicate.js` defines 7 historical syndicates x
3 ranks (Boss/Underboss/Capo, 21 named NPCs total) with full bios and
daily schedules: Chicago Outfit (Capone/Nitti/Ricca), Five Families/
Luciano (Luciano/Genovese/Costello), National Crime Syndicate (Lansky/
Siegel/Cohen), Medellin Syndicate (Escobar/Gaviria/Ochoa), Griselda Empire
(Blanco/Osvaldo/Dixon), Murder Inc. (Lepke/Anastasia/Weiss), Speakeasy
Syndicate (Rothstein/Waxey/Remus). `src/features/government/
crimeSyndicates.js` (`CRIME_SYNDICATES`) mirrors the same 7 syndicates/21
IDs with palettes, aggression, extortionPower, and dailyToll, and is
already wired into world-presence simulation (`agentRegistry.js`,
`characterDispositions.js`, `townMigrationEngine.js` — fugitive/heat
behavior sends members to ground based on `crimeSyndicatesState.heatLevel`
from `GovernmentModal`). So all 21 members already have *some* simulated
presence; only the *player-facing job/content* layer is thin.

**Current player-facing surface (thin):** The Underworld building
(`UnderworldModal.jsx`) exposes only 4 flat tabs (Black Market, Call
Center Ops, Crime Alley, Speakeasy Hotel) via generic one-button gambles
(`districtBuildings.js`) plus Luciano as the only reachable named boss
in-building (`NamedNpcModal` embedded in Crime Alley). Real syndicate
structure (rank, territory, rivalry) isn't expressed as gameplay yet.

**Contradiction to flag:** `src/features/world/syndicateActivitiesEngine.js`
(`SYNDICATE_OPERATIONS_CATALOG`, surfaced via the phone's Syndicate
Operations app) is a *third*, independently-hand-written syndicate list
that mostly maps to the same 7 (by boss names) but uses mismatched
territory names (Osaka/Tokyo/Kyoto/Sapporo — city names, not the
Underground/Commercial/Financial/Government District system used
everywhere else) and adds an 8th, non-canonical syndicate ("Golden
Triangle Cartel," boss listed only as generic "Asian Cartel Syndicate")
with no bio, schedule, or named characters, and a reductive real-world
ethnic framing worth reconsidering on its own merits regardless of the
consistency issue. This needs an explicit call: fold this into the
canonical 7 (drop Golden Triangle or give it real named characters +
fix territory names to match the District system), or keep it as a
deliberately separate "rumor mill" abstraction layer — recommend the
former since it directly undercuts the canon roster's territory data.

---

## Cross-world notes

- Ambient/filler NPCs (`npcGenerator.js`'s `generateAmbientNpc`) are
  purely cosmetic — random first name, personality tag, visual trait,
  deterministically seeded palette from an id string. They carry no lore
  and are not referenced by any named-NPC storyline; safe to keep
  treating them as disposable background color.
- All four world scenes share the same building-block visual grammar
  (tile terrain, `drawBuildingFacade`, wander AI for ambient actors,
  police/wanted-level escalation), which is consistent and fine to keep
  leaning on for tone parity across worlds.
