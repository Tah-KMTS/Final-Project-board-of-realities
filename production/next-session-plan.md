# Next Session Plan

Written 2026-08-01, continuing on laptop. Three tracks, roughly in priority order. Nothing below has been implemented yet — this is a scoping/handoff doc, not a changelog.

---

## 1. Jail mini-map + bribe-dice + maze-to-Underworld (fully scoped, ready to build)

This is the oldest-pending item — 3 design passes (game-designer, technical-artist, world-builder) already ran in parallel and are fully synthesized and consistent with each other. Nothing new needed here except implementation + a short plan write-up + your go-ahead. Full detail lives in Claude's memory file `jail-minimap-maze-plan.md`, but the load-bearing decisions are:

**Mechanic (game-designer):**
- Replaces the old flat `attemptJailEscape` with two separate actions:
  - `attemptJailBribe(bribeAmount, isFinalAttempt)` — 2d6 vs `TN = 8 + wantedLevel + floor(notoriety/25)`, bribeBonus/streetwiseBonus/luckBonus added. Money spent regardless of outcome. 3 attempts/sitting. Caps at ~92% success even at full bail cost — bribing can never fully beat just paying Bail.
  - `attemptMazeSegment(segmentIndex)` — single committed run, 4 cosmetic segments (round-resolution list, not a real pathfinding grid), patrol/evade chance per segment favoring AGI. Win = freed. Lose = harsher than Bribe (+1 sentence day, +8 notoriety, **+1 wantedLevel** — the only jail-failure path that raises wantedLevel).
  - On maze win: cash reward capped against `bailCost` (`min(round(bailCost*0.5), $5000)`), NOT against Underworld's much larger economy — auto-open `UnderworldModal` once, framed as emerging through the tunnel. Do NOT add any new Underworld/Hitman/Syndicate/Narcotics bonus tied to this — that's the scope-creep trap game-designer flagged explicitly.
- 3-way balance already checked: Bail (certain, full price) / Bribe (flexible, capped below 100%) / Maze (free, highest variance, only path that spirals wantedLevel on failure).

**Technical shape (technical-artist):**
- Do NOT build a new `Phaser.Scene` subclass. Build as new zones (`jailCell`, `jailMaze`, `jailUnderworld`) inside `OverworldScene.js`'s existing swappable-zone system (`ZONES` map, `INTERIOR_TEMPLATES`, `buildLayout()`) — same pattern already used ~98 times for building interiors. Zero new art needed (palette-only floor/walls, like every other interior).
- Replace `WorldScreen.jsx`'s current `jail.inJail` full-screen-modal-override effect with a scene-zone swap (`bridge.emit('enterJail')` → `sceneRef.current.loadZone('jailCell')`).
- Slim `JailEscapeModal.jsx` down to just the two resolution actions, triggered by an in-scene interactable (walk up + press E), not a takeover.

**Lore (world-builder):**
- Don't invent a second literal underworld — the maze is a back-door service tunnel (parking sublevel / loading dock / a corridor a bribed staffer "forgot" to seal) that dead-ends at the *existing* Underworld building's back room. Dress as crates/delivery-cart/service-lighting, not rock/sewer tiles.
- Name the jail generically/unglamorously — **"Capital City Central Booking"** or **"Precinct Holding"** — don't tie it to any of the 7 named crime syndicates or reuse the FBI/RICO framing (`FbiInterrogationModal.jsx` is a separate, higher-tier system).
- Guard (takes bribe) and inmate (hints at escape route) stay generic/unnamed. **Reuse Lucky Luciano** as the fixer waiting at the tunnel's Underworld-side exit — he's already in `UnderworldModal.jsx`'s Crime Alley tab, so this costs zero new lore.
- Tone: bureaucratic indignity, not dread. Match `FbiInterrogationModal.jsx`'s deadpan register but lower stakes.

**This session's new wrinkle — the jail now gets a real building.** See Track 2 below: "Court & Prison" is one of the 3 remaining unbuilt categories from the original 14-building spec, and the user independently flagged jail/prison as a missing building tonight. These are the same thing — build the jail's physical building (Track 2) and the jail mini-map mechanic (this track) together rather than as two separate passes. The building gives the mechanic a real door/location on the overworld map; the mechanic gives the building something to do.

**Next step:** write the short implementation plan (store actions → OverworldScene zones/maze-gen → modal UI → flavor text → QA), get user sign-off, then dispatch gameplay-engineer. This is the first thing to pick up next session.

---

## 2. Three missing buildings: Court & Prison, Dock/Pier (wharf), Entertainment Complex

**Important finding from tonight:** these are not a random new idea — they're literally the last 3 unbuilt categories from the original 14-main-building-category spec that this project has been working through in phases. Confirmed via a comment block at `src/game/scenes/OverworldScene.js:106-124`:

> "The remaining 4 spec categories (Court & Prison, Food Center, Dock/Pier, Entertainment Complex) are still unbuilt." (Food Center has since been built as `foodCourt` — see `FINANCE_BUILDING_DEFS` at line ~168 — leaving exactly these 3.)

Currently-built hub buildings for reference (`FINANCE_BUILDING_DEFS`, `OverworldScene.js:130-190`): `stockExchange`, `businessCenter`, `bank`, `realEstateAgency`, `governmentBuilding`, `temple`, `casino`, `foodCourt`, `underworld`, `industrialZone`, `trainStation`. Several of these are multi-tenant "hub" buildings with a tabbed modal (`BusinessCenterModal.jsx`, `UnderworldModal.jsx`, `GovernmentBuildingModal.jsx`, `IndustrialZoneModal.jsx`) absorbing what used to be several single-tenant buildings — that's the established pattern for a building that needs to hold more than one distinct activity.

**Court & Prison** — this is the jail building from Track 1. Build it as part of that track, named per world-builder's recommendation ("Capital City Central Booking" / "Precinct Holding"), not as a separate design pass.

**Dock/Pier (wharf)** and **Entertainment Complex (concert hall & sports stadium)** — SCOPED 2026-08-01. All 4 passes (2x world-builder, game-designer, technical-artist) ran in parallel and are synthesized below, ready for gameplay-engineer. Both designs deliberately reuse existing-but-unused lore/mechanics rather than inventing anything new.

> **User override, 2026-08-01 (after the above was scoped):** the user wants real minigames here after all, superseding the "flavor-only" recommendations below for all three slots. Not yet redesigned — flag for a fresh game-designer/technical-artist pass before implementation:
> - **Wharf**: should have a fishing minigame (reverses the "flavor-only, no new mechanic" call below — needs its own scoping pass, including how it avoids duplicating the Narcotics/Syndicate systems' existing waterfront content).
> - **Concert Hall** (Entertainment Complex): should have an arrow-key rhythm/music minigame (reverses the "Dixon `NamedNpcModal` tab, flavor-only" call below).
> - **Sports Stadium** (Entertainment Complex): should have "some other minigame" — user has NOT decided what yet, explicitly deferred. Do not assume it's still the moneyline-bet spec below; ask before building anything here.
>
> Also noted for later, unrelated to these 3 buildings: after Tracks 1/2 are done, user wants a pass on **mobile/smartphone UI** responsiveness. Not scoped at all yet — raise it fresh when that work starts.

### Dock/Pier ("the wharf") — final shape

**What it's for:** NOT smuggling — that's already fully owned by `NarcoticsTradeModal.jsx`/`SyndicateOperationsModal.jsx` (reachable via the phone, no building needed) and by the Five Families' existing "Tokyo Waterfront Docks" territory in `syndicateActivitiesEngine.js`'s `SYNDICATE_OPERATIONS_CATALOG` (racket: Cargo Theft/Smuggling Warehouses). Building a wharf smuggling loop would duplicate content that already exists and is already reachable — both world-builder and game-designer independently flagged this as the conflict to avoid. Instead: **marine cargo insurance fraud and customs/manifest fraud** — a ship "lost at sea" that never sailed, containers stamped "inspected" without being opened, a bill of lading that says "textiles" over an empty hold. Corruption wearing a suit and holding a clipboard, distinct in kind from the Underworld's back-alley crime.

**Characters:** none new. Stays entirely generic/ambient (customs inspector, port clerk, marine insurance adjuster), matching the jail precedent. Two optional light-touch flavor callbacks only, neither a real building tenant: a Vanderbilt flavor-text line (he's historically a shipping magnate, already placed in `businessCenter` — don't give him a second interactive instance here); an ambient Genovese/Costello toll-collection line (both have waterfront-heavy bios in `syndicate.js` but are currently un-slotted into any building — a cameo line is legitimate reuse of otherwise-dead lore, not a new tenant).

**Mechanic:** flavor-only, honestly comparable to `foodCourt`. Build it as a data-only `InteractiveLocationModal` entry (same content type `foodCourt` already uses) — no new component, no new store action. If any mechanical action is wanted at all: reuse the exact shape of Ford's existing `inspect_line` action (`$100` cost → flavor-text reward, zero real state change — confirmed this exact "looks mechanical, is actually flavor" pattern already ships for Ford/Apple in `interactiveLocations.js`, so it's established precedent, not a new idea). **Do not** wire this into stocks/real-estate/company-ownership systems.

**Build shape:** `4x3` footprint, `facadeStyle: 'modernBrick'` (reuses the already-verified `redBrick` nine-slice, same family as `casino`/`underworld` — reads as gritty/industrial). `zone: 'industry'`. Straight-to-modal like `foodCourt` (no Phaser interior/walk-in room needed) — this is the leaner, better-fitting option given the flavor-only mechanic; a bank-style walk-in interior with a "Harbor Master's desk" is available as a fallback if more spatial presence is wanted later, but isn't the recommended default. Optional zero-cost visual touch: place its footprint against a strip of the map's existing procedural water-tile band (already impassable via `isBlockedTile`, no new mechanic) so it visually reads as a pier without inventing anything.

**Naming:** avoid "Docks" (already overloaded/stale as a pre-flattening district label elsewhere). Lean bureaucratic-boring: **"Bonded Cargo Pier"**, **"Harbor Customs House"**, or **"Free Trade Terminal"**.

### Entertainment Complex (concert hall + sports stadium) — final shape

**The key finding: two existing named characters are written but currently un-slotted into any building, and both are exact thematic fits.**
- **Arnold Rothstein** (Crime Syndicate roster, Boss of "The Speakeasy Syndicate") — bio literally says he "famously fixed the 1919 World Series," already has an existing ambient dialogue line about it (`financeDialogue.js`), and already has an explicit **`'Fixed Sports Betting'`** racket entry with a real $/day yield in `syndicateActivitiesEngine.js`'s `SYNDICATE_OPERATIONS_CATALOG` — none of which currently has a physical building. → **Sports Stadium tab.**
- **Dixon Trujillo** (Griselda Empire Capo) — established specialty is literally **"Nightclub Extortion & Entertainment Fronts,"** hangout described as hosting "high-profile parties for celebrities, DJs, and city officials... quietly gathering leverage." → **Concert Hall tab.**

**What each tab is for, satirically:**
- **Sports Stadium**: not really about sports — it's Rothstein's fixed-odds operation with a scoreboard bolted on. Point-shaving, phantom injury reports sold as insider tips, referees on retainer.
- **Concert Hall**: not really about music — it's Dixon's entertainment-front laundering operation. Inflated production budgets, payola disguised as "booking fees," VIP bottle service as the actual profit center. Nobody in the room cares about the music; they care about the invoice.

Both keep the "everything is corruptible and mundane" tone by making the glamour an explicit cover story the characters themselves are bored by.

**Characters, reconciled:** zero new characters needed — athletes/musicians stay fully generic/ambient (unnamed announcer, unnamed headliner), same discipline as jail's unnamed guard. **One implementation-shape question for gameplay-engineer to resolve, not re-litigate:** world-builder framed both tabs as `NamedNpcModal` slots (matching the established hub convention where each tab in `businessCenter`/`industrialZone` is a named character); game-designer independently proposed Concert Hall as a flavor-only `InteractiveLocationModal` items tab instead. Recommended reconciliation: **Concert Hall = Dixon `NamedNpcModal` tab** (flavor/relationship conversation, zero new mechanic, matches the hub convention other tabs already use) and **Sports Stadium = Rothstein `NamedNpcModal` tab that also embeds the betting mini-game** (precedent: the Underworld hub's Narcotics tab already combines an NPC-flavor angle with a real trading mechanic in one tab, so this isn't a new pattern).

**Sports Stadium mechanic — the one genuinely new component needed, fully specified:** a single-shot moneyline bet on a procedurally-flavored matchup, resolved instantly (no season simulation). Grounded in the project's own numbers, not invented:
- `MIN_BET = $25`, 5 energy per bet (matches `RussianRoulette.jsx`'s stakes tier, not `Slots.jsx`'s lower/repeatable one).
- Odds: favorite `0.65` implied win probability, underdog `0.35`.
- Payout multiplier: **must hold this project's existing 90% RTP invariant** — both `Slots.jsx` and `RussianRoulette.jsx` independently converge on this exact house edge, so it's a project-wide gambling rule, not a per-game choice. Same closed-form math as `RussianRoulette.jsx`: `fairMultiplier = 1/p × 0.9`. Favorite → `~1.38x`. Underdog → `~2.57x`.
- Luck-save: reuse `Slots.jsx`'s exact formula verbatim (`min(0.15, (effectiveLuck-5)*0.02)` chance to push a loss back to a refund, never converts a loss into a win) — don't invent a new luck formula.
- Reputation: reuse `Slots.jsx`'s big-win-threshold convention (`+2/+3` reputation on an underdog win specifically).
- **Balance check, explicit:** because it's built to the same -10% EV as the Casino's own games by construction, it cannot out-compete or trivialize the Casino — the only difference is variance shape (moneyline vs. reels vs. push-your-luck), exactly how Blackjack/Poker/Slots/Roulette already coexist without one dominating. **If a future pass is ever tempted to make the underdog payout "more generous for fun," that breaks this invariant — check the exact -10% EV math first.**
- No new store actions or player stats needed — reuses `addCash`, `spendEnergy`, `getEffectiveLuck`, `addReputation`, all already generic.
- Open, non-blocking flavor question (tone call, not a balance one): should matchups use existing character names as team mascots/owners (e.g. "Vanderbilt Rail" vs. "Carnegie Steelers," zero new lore cost) or stay fully generic ("Home Team"/"Away Team")? Either works mechanically.

**Build shape:** one building, 2 tabs, `7x4` (or `6x4` to match `underworld`/`governmentBuilding`'s slightly smaller hub size — either works), `facadeStyle: 'modernGlass'` (reuses the verified `concreteGlass` nine-slice already used by `stockExchange`/`businessCenter`/`trainStation`). `zone: 'industry'`. **No Phaser interior/walk-in room needed at all** — important correction to a prior assumption: every existing tabbed hub (`businessCenter`/`underworld`/`governmentBuilding`/`industrialZone`) already routes straight from the overworld interaction into a React modal with zero Phaser interior room; there's no "does a stadium interior need to look distinct" problem to solve, because none of the hub buildings have a walk-in interior to begin with. That visual identity is entirely React/Tailwind (border/panel colors, tab labels) — `visual-polish`'s territory at implementation time, not a Phaser/canvas concern.

**Correction to a build-technique assumption used in earlier scoping (jail included):** buildings are NOT palette-only on the exterior — real Kenney tile-pack art is already loaded and drawn for every exterior facade (`modernGlass`→`concreteGlass` nine-slice, `modernBrick`→`redBrick` nine-slice, both already verified/in-use). "Palette-only, no new art" is true for **interiors and ground tiles only** (flat `Graphics.fillRect`), not exteriors. This doesn't block anything here — both new buildings reuse already-loaded, already-verified facade families — but don't carry the "buildings are palette-only" framing forward uncorrected into other scoping.

### Cross-cutting: merge-coordination risk (not a layout risk)

Three separate efforts (jail's Court & Prison building, the wharf, the entertainment complex) will all be adding entries to the same `FINANCE_BUILDING_DEFS` array and touching the same `triggerInteraction`/`WorldScreen.jsx` switch statements around the same time. `layoutFinanceMap`'s packer recomputes zone widths from content automatically and is verified overlap-free by construction, and `MAP_ROWS` is fully dynamic — so this is **not** a spatial/overlap risk. It IS a **merge-coordination** risk (three diffs touching the same few hundred lines). Recommendation: build one at a time rather than in parallel, and re-run the existing standalone overlap/bounds verification pass (see the header comment above `FINANCE_BUILDING_DEFS` in `OverworldScene.js`) after each merge, since it's a manual check, not CI-enforced.

### Suggested build order

Jail (Court & Prison) first — already fully scoped end-to-end including this building. Then wharf (smallest: data-only, no new component). Then entertainment complex (needs one new component, `SportsBetting.jsx`, ~150-170 lines by the `Slots.jsx` size comparison, plus a 2-tab wrapper modal ~60 lines like `IndustrialZoneModal.jsx`).

---

## 3. NPC swarming/clustering at buildings — FIXED 2026-08-01, committed and pushed

User's screenshot (`สกรีนช็อต 2026-07-31 232813.png`, "Capital Syndicate Mega-Map") showed 8-10+ named roamers overlapping in dense clumps at a handful of buildings (Neon Dragon Casino, The Underworld, Real Estate Agency). Root-caused and fixed in `src/features/agents/characterDispositions.js`.

**Root cause, confirmed:** all 30 characters in `governmentRoster.js` (10 Presidents, 10 Fed Chairmen, 10 FTC Chairmen — exactly the names in the screenshot: Reagan, Jefferson, Washington, Obama, Kirkpatrick, Muris, Martin, Burns, Meyer, Miller) had **zero entries** in `WORK_BUILDING_OVERRIDES`. All 30 fell through to `fallbackWorkBuildings()`, which draws from the same flat 10-building `REAL_BUILDING_IDS` pool every other uncovered character uses — no role awareness at all. Compounding it, `isPublicFacingCategory()` skewed 60% of them into the `socialite` tier, whose business-hours `homeAffinity` floor is near 0 (almost never home). ~30 characters, nearly always "out," all drawing from the same undifferentiated pool = periodic pile-ups on whichever building won the hash lottery that tick.

**The fix (two parts, both in `characterDispositions.js`):**
1. Added 30 `WORK_BUILDING_OVERRIDES` entries, one per government-roster character, each picked for thematic fit (a president's `executivePriority`, a Fed chair's `policyBias`, an FTC chair's `bias`/`description` — e.g. `pitofsky` → `industrialZone` because his description literally names Rockefeller Oil/Carnegie Steel, both already folded into that building; `muris` → `underworld` because his description is about busting underground call-center scams). As a set they spread across nearly all 10 real buildings instead of converging on 1-2.
2. Rebalanced the `isPublicFacingCategory` tier skew from 60/30/10 (socialite/regular/homebody) to 40/40/20 — cuts how many of the 30 are simultaneously "out" without touching the tier system's behavior for anyone else (titans, crime syndicate — that skew is category-gated to just these 3 government categories).

**Verified:** `npm run build` passes, `npm run lint` unchanged (0 errors, same pre-existing warning set). Could not get a live runtime simulation working in this session (plain Node ESM doesn't resolve this project's extensionless relative imports without a bundler, and no vite-node/tsx was available) — the fix is verified by build/lint plus a full manual trace of the resolution logic, not a live probability check. **If you want numeric confirmation next session:** write a small Vite-aware script (or a temporary test using the project's existing bundler) that calls `simulateWorldPresence()` for the 30 government-roster ids across a few `timeBlockIndex` values and tabulates `buildingId` counts — should show them spread across ~8-9 buildings instead of piling on 2.
- Should still get your own eyes on it in a live playthrough to confirm it *looks* right, not just that the formula changed correctly.

**Not touched, out of scope for this fix:** the ~35 Financial Titans already have real overrides; the ~21 Crime Syndicate members intentionally cluster at `underworld` only (thematically correct, small headcount). If crowding still shows up elsewhere after this, it's a different population than the one just fixed.

**Dead code note, not touched:** `agentMovementEngine.js`'s `TITAN_ROUTINES`-based `updateAgentPositions()` is explicitly commented as unused (`OverworldScene.js`'s `updateNamedRoamers` reads from `worldPresenceEngine.js` instead) — don't confuse it with the live path if debugging further.

---

## Side note — ambient filler NPCs (resolved 2026-08-01)

User asked who the unfamiliar 5-6 NPCs are ("Inn", "Ze something" etc.) — these are **procedurally-generated ambient filler townsfolk**, not part of the 76-character named roster, from `src/utils/npcGenerator.js`. Only the live scene's spawn count matters: `OverworldScene.js` (the only reachable map — see below) spawns `generateAmbientNpcs('finance_ambient', N)`.

**Changed this session, at the user's request:** the name pool is now the team's own names — **Tah, Jeff, Ince, Franc, Tan, Poom** — and the live spawn count was dropped from 8 to 6 (`OverworldScene.js:2451`) to match exactly, one of each with no repeats. Team member **Poom** plans to build a gimmick/mini-game around these 6 later — not scoped yet, just flagged so a future session doesn't reset the name list back to generic filler without checking first.

Note: `KyotoScene.js`/`OsakaScene.js`/`TokyoScene.js`/`SapporoScene.js` still call `generateAmbientNpcs` with old counts (10/6/8/8) but are dormant/unreachable dead code per `GameCanvas.jsx`'s `SCENES_BY_MODE` mapping (everything routes to `OverworldScene`) — left untouched since they never render.
