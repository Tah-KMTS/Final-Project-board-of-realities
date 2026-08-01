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

**Dock/Pier (wharf)** and **Entertainment Complex (concert hall & sports stadium)** — genuinely new scope, no existing lore/mechanic tie-in yet. The entertainment complex is a natural fit for the same multi-tab hub pattern (concert hall tab + sports stadium tab, like `IndustrialZoneModal.jsx`'s 5 tabs). Before building either:
- **world-builder**: what these are for narratively/tonally in this satirical finance-world, whether any existing characters populate them (athletes/musicians aren't part of the current 76-character roster — may need generic ambient NPCs only, or a small new named cast), how they connect to the existing gambling/economy loop (sports betting tie-in to the casino? ticket scalping? concert-based crime syndicate money laundering, matching the show's "everything is corruptible" tone?).
- **game-designer**: whether these need new mechanics (a mini-game, a betting interface) or are flavor/atmosphere buildings with a simple `InteractiveLocationModal` like `foodCourt`. A wharf could plausibly tie into smuggling/Underworld logistics — worth checking with game-designer whether that's worth building or scope creep.
- **technical-artist**: footprint/facade style sizing consistent with existing hubs, palette-only build (same technique as everything else — no new art assets needed per this project's established constraint).

Recommend running these 3 scoping passes in parallel next session, the same way jail's 3 passes ran tonight, before implementing.

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
