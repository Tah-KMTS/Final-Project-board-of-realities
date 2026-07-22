# Backlog & Handoff Notes

Last updated after the Capital Syndicate rebrand. If you're picking this project up fresh, read this whole file before touching code - it explains what exists, what's mid-flight, and what to set up locally first.

## Current state (read this first)

- The game was rebranded from "Board of Realities" to **Capital Syndicate: Financial Reality Engine** - a dark neon, cyberpunk-Tokyo financial sandbox RPG.
- **By current direction, only the Finance world is in play.** Hunter's Rift and King of Games are deliberately sealed off (not deleted) in `src/game/scenes/OverworldScene.js` (`isBlockedTile` returns `true` unconditionally for those regions) and hidden from `WelcomeScreen.jsx`'s dev-jump menu and the New Game flow. To bring them back: search both files for the "Focus mode" comments, which mark every spot that was changed and say exactly what to restore.
- The 4 original worlds were merged into **one continuous overworld** (`OverworldScene.js`) rather than 4 separate Phaser scenes; Domino City remains its own scene, entered through a gate like walking into a building.
- **Character Creator and the dice-roll screen are gone.** "New Game" on the welcome screen goes straight into the world with one fixed character (`startNewGame()` in `useGameStore.js`). There's only one world and one path in right now, so those screens had nothing left to choose between.
- Finance world is now a **4-district map**: Financial District, Commercial District, Underground District, Government & Cultural District (see `FINANCE_BUILDINGS` in `OverworldScene.js`, and `districtBuildings.js` for the buildings' in-game actions).
- Core loop: a Day Counter with an "End Day" button (`endDay()` in the store) that ticks the market, rolls a news headline, and cools down Heat. Win condition is **$1,000,000,000 net worth** (`NET_WORTH_WIN_TARGET` in `marketData.js`).
- Tycoon bosses: Buffett, Vanderbilt, Musk, and Howard Marks (added this round - see `production/finance-world-reference.md` for his real-world grounding). A roster of 46 more real-world finance figures is planned as ambient NPCs but **not yet implemented** - see `production/finance-npc-roster-50.md` for the full list and which 4 are bosses vs. which 46 are ambient-only.
- Voice lines: 20 named characters have real generated voice-over via `scripts/generate-voice-lines.mjs` (OpenAI TTS, `gpt-4o-mini-tts`). **Requires your own `OPENAI_API_KEY` in a root `.env` file** (gitignored, never committed) to regenerate or add more.
- A live NPC free-text chat backend exists at `backend/` (FastAPI + OpenAI `gpt-4o-mini`). Needs the same `OPENAI_API_KEY` and must be run as its own process alongside `npm run dev` - see `backend/README.md`. Content boundary: romantic actions cap at a kiss, gated by relationship tier, enforced in the system prompt.
- Reference docs for lore/world-building grounding live in `production/`: `solo-leveling-reference.md` (Hunter, currently sealed but kept for when it's revisited), `finance-world-reference.md`, `finance-npc-roster-50.md`, `yugioh-world-reference.md` (scoped strictly to the original Yugi-protagonist era), `world-bible.md`.

## Known environment gotchas

- No automated test coverage anywhere (no test files; `npm run lint` is oxlint only) - all regression checking is manual playtesting or live browser verification.
- If you're testing via a headless/automated browser, `document.hidden`/`visibilityState` can end up `"hidden"` even when the tab looks active, which suspends Phaser's `requestAnimationFrame` loop - movement/animation will look completely frozen even though the underlying logic is correct. Verify by grabbing the scene instance and manually calling `tileMover.update(delta, direction)` a few times rather than assuming it's broken.
- Git commits need `user.name`/`user.email` configured locally (`git config --global ...`) - a fresh machine won't have this set.

## Open items, roughly in priority order

- [ ] **Run a full bug-bash/QA pass** across everything added during the rebrand - hasn't happened yet despite a lot of new surface area (4-district map, Day Counter loop, voice cast, chat backend).
- [ ] **Smartphone overlay UI** - a persistent phone icon that slides out a mobile-OS-style interface with 5 apps: Social/X (post to manipulate market sentiment), Banking & Portfolio, Contacts & Romance, Dark Web & Underground (scams, hacking, ransom), Startups & M&A. Not started.
- [ ] **3 mini-games**: Labubu claw machine (Arcade), casino games (Blackjack/Poker/Russian Roulette), Street Brawler Arena. Not started.
- [ ] **3 GenAI agent systems**: Market Engine (daily price adjustment from events/actions - partially covered by `tickFinanceMarket`), NPC Mind (dialogue/negotiation - overlaps with the `backend/` chat system already built), Sentiment Engine (social posts/news → FOMO/panic selling). Not started as distinct systems.
- [ ] Add ambient background music for districts beyond what already exists - most of Capital Syndicate's map is still silent outside SFX.
- [ ] Implement the 46-NPC ambient finance roster from `finance-npc-roster-50.md` (currently only the 4 bosses exist).
- [ ] Decide whether to build out the free-text NPC interaction system (offline keyword-matched, discussed but not built - a live-API Python backend was built instead for structured NPC chat).

## Paused (Hunter's Rift / King of Games / Domino City) - kept for reference, not being worked on

- Give professions (incl. Shadow Monarch) a distinct sprite/palette - `professionId` is never read by spriteGen/characterPalettes.
- Marriage-progression inconsistency between Hunter's FamilyModal (propose on first meeting) and World 3's Téa (requires relationship progression first).
- 67 of ~150 DDM monster abilities and 18 of 50 DDM items are tagged `not_implemented` in the UI.
- No win/clear condition wired for Domino City (`clearBlock('domino')`/`clearWorld4` never called).
- `recordTier4Defeat` doesn't track Tier 5 (Yugi/Kaiba) wins toward anything persistent.
- A Solo Leveling-inspired rework (multi-monster rift battles, Shadow Army extraction/Arise mechanic) was scoped in `solo-leveling-reference.md` but not built - Hunter world is currently sealed off.
