# Backlog & Handoff Notes

Last updated after the map rework (flattened single-city layout, tight residential clusters) and a full "make the game fun" session (non-lethal combat, jail/escape, net-worth milestones, LLM-narrated events, Sole Survivor counter, Luck-in-casino-odds). If you're picking this project up fresh, read this whole file before touching code - it explains what exists, what's mid-flight, and what to set up locally first.

## Current state (read this first)

- The game was rebranded from "Board of Realities" to **Capital Syndicate: Financial Reality Engine** - a dark neon, cyberpunk-Tokyo financial sandbox RPG.
- **Only the Finance world is reachable from the overworld.** `REACHABLE_BLOCK_IDS = ['finance']` in `src/store/useGameStore.js` is the single source of truth for this - verified directly in code this pass. Hunter's Rift, Yu-Gi-Oh, and Domino City are fully built (modals, dialogue, monster/NPC rosters, `DominoWorldScene.js`) but structurally unreachable: nothing in `OverworldScene.js`'s generation links to them, so they sit dormant rather than deleted. To bring one back it needs to be re-added to `OverworldScene.js`'s generation from scratch or restored from git history, not just un-hidden.
- **Character Creator and the dice-roll screen are gone.** "New Game" goes straight into the world with one fixed character (`startNewGame()` in `useGameStore.js`).
- **Map (current, post-rework)**: `OverworldScene.js` now builds a single flattened city map with no district concept at all - `FINANCE_BUILDING_DEFS` is one flat pool packed by `layoutFinanceMap()`, arranged in a cross-quadrant layout around the Chapel (the Chapel occupies a fixed center-column reservation; law/finance/industry buildings pack into column zones either side). This supersedes the earlier "4-district map" (Financial/Commercial/Underground/Government & Cultural) described in older notes below in this doc's history - that layout is gone, not just relabeled.
  - **10 hand-authored hub buildings are actually built**, not the full 14-category spec: Tokyo Stock Exchange, Capital Business Center, Bank & Realty Office, Real Estate Agency, Federal Government Building, Whispering Temple Chapel, Neon Dragon Casino, The Underworld, Industrial Zone, Central Train Station. (`FINANCE_BUILDING_DEFS` in `OverworldScene.js`, counted directly this pass.)
  - **4 spec'd categories remain deliberately unbuilt - decision, not an oversight (see next section).**
  - Residential buildings are separate: character homes/hideouts are packed into tight, zero-gap clusters (`packHomeBand()`), one uniform color per cluster, with walkable `ROW_GAP`/`CLUSTER_GAP` gaps between rows/clusters so the map doesn't read as one solid impassable block.
  - **Live-screenshot QA'd this session**: layout reads as coherent and shippable, all cluster colors read correctly and distinctly, no rendering bugs found.
- **4 unbuilt building categories - firm scope decision this session, defer all 4.** This lives only as a code comment in `OverworldScene.js` (~line 106-123) - this doc is the first place the reasoning is written down anywhere else:
  - **Court & Prison** - deferred, and now actively redundant: the jail system (below) force-routes an arrest straight into an abstract modal, with no walk-to-building step. A physical prison building would either sit inert or need a whole new voluntary-visit mechanic that doesn't exist yet.
  - **Dock/Pier** - deferred: duplicates the existing `trainStation`'s travel purpose, and cuts against the map's deliberately trimmed/flattened identity.
  - **Entertainment Complex** - deferred: redundant with the casino, which just got fresh investment this session (Luck wired into odds - see below).
  - **Food Center** - deferred, but has a real, cheap hook if ever picked up later: a mid-day energy top-up, the inverse of the existing `spendEnergy`. Not a priority now.
- Core loop: a Day Counter with an "End Day" button (`endDay()` in the store) that ticks the market, rolls a news headline, and cools down Heat.
- **Win condition reworked this session**: a 5-tier net worth milestone ladder ($50k / $250k / $1M / $5M / $10M) retargets the real Finance win to a reachable $10M net worth (was an unreachable $1B `NET_WORTH_WIN_TARGET`). The old $1B target is kept only as a flavor "flex goal" past the real win, not the win condition itself.
- Tycoon bosses: Biffle, Vanderbilt, Rusk, and Howard Marks. A roster of 46 more real-world finance figures is planned as ambient NPCs but **not yet implemented** - see `production/finance-npc-roster-50.md`.
- Voice lines: 20 named characters have real generated voice-over via `scripts/generate-voice-lines.mjs` (OpenAI TTS). Requires your own `OPENAI_API_KEY` in a root `.env` file to regenerate or add more.
- A live NPC free-text chat backend exists at `backend/` (FastAPI + OpenAI `gpt-4o-mini`) - needs the same `OPENAI_API_KEY`, run as its own process alongside `npm run dev`. Content boundary: romantic actions cap at a kiss, gated by relationship tier, enforced in the system prompt.
- Reference docs for lore/world-building grounding live in `production/`: `solo-leveling-reference.md` (Hunter, sealed but kept for a future revival), `finance-world-reference.md`, `finance-npc-roster-50.md`, `yugioh-world-reference.md`, `world-bible.md`.
- Real-world figures used as NPCs were renamed to fictional analogues to close a real-person legal-risk gap (Warren Buffett -> Warren Biffle, Elon Musk -> Elan Rusk, etc. - full mapping is in git history if needed); historical/deceased figures were left as-is.

## "Make it fun" session - completed this pass (build/lint-clean and live QA-verified)

- **Non-lethal Finance-world combat losses.** Losing an optional side fight used to be permadeath; it's now survivable, with pre-fight bodyguard warnings before engaging. QA found and got fixed along the way: a dead-code bug (missing Attack button in the named-NPC modal) and a follow-on crash when attacking non-Financial-Titan NPCs.
- **Jail/escape/bail system** (`src/features/jail/`, notably `JailEscapeModal.jsx`), wired into `executeCrime`'s fail path in `useGameStore.js`, plus a new Chapel "Luck" blessing. Alongside it, the Temple embezzle payout was cut ($50k -> $20k) to close the gap where crime paid dramatically better than legit income.
- **5-tier net worth milestone ladder** ($50k/$250k/$1M/$5M/$10M), retargeting the real win condition to a reachable $10M (see Current State above for detail).
- **LLM-narrated daily events** via `VITE_OPENAI_API_KEY` - fire-and-forget, with a graceful fallback to templated text when there's no key or the call fails. Raid and hype events now actually move stock prices and crypto hype, rather than being purely decorative text as before.
- **Sole Survivor HUD counter**, surfacing an already-existing but previously invisible alt-win condition (kill all rivals). Corrected the roster count while building it: 27 named tycoons + 8 ambient kills, not the previously assumed 4+8.
- **Luck wired into casino odds**: Slots gets a post-loss "lucky save" chance; Russian Roulette gets a round-1-only bang-chance discount, deliberately *not* applied to every round after a naive always-on version was proven to flip the house edge player-positive; Blackjack gets a card-counting catch-chance nudge. Poker was deliberately left untouched - Luck there would dilute its existing PER-stat (charisma/bluffing) identity.

## Known environment gotchas

- No automated test coverage anywhere (no test files; `npm run lint` is oxlint only) - all regression checking is manual playtesting or live browser/screenshot verification.
- If you're testing via a headless/automated browser, `document.hidden`/`visibilityState` can end up `"hidden"` even when the tab looks active, which suspends Phaser's `requestAnimationFrame` loop - movement/animation will look completely frozen even though the underlying logic is correct.
- Git commits need `user.name`/`user.email` configured locally - a fresh machine won't have this set.

## Open items, roughly in priority order

- [ ] **Manual playtest pass on the reworked map** - build/lint are clean and this session's live screenshot QA confirmed layout/colors, but a full walk-every-building interaction pass (desk -> correct modal, for all 10 hubs plus home/hideout interiors) hasn't been logged as done.
- [ ] **Smartphone overlay UI** - a persistent phone icon that slides out a mobile-OS-style interface with 5 apps: Social/X (post to manipulate market sentiment), Banking & Portfolio, Contacts & Romance, Dark Web & Underground (scams, hacking, ransom), Startups & M&A. Not started.
- [ ] **3 GenAI agent systems**: Market Engine (daily price adjustment from events/actions - partially covered by `tickFinanceMarket` and this session's LLM-narrated events), NPC Mind (dialogue/negotiation - overlaps with the `backend/` chat system already built), Sentiment Engine (social posts/news -> FOMO/panic selling). Not started as distinct systems.
- [ ] Implement the 46-NPC ambient finance roster from `finance-npc-roster-50.md` (currently only the 4 bosses exist).
- [ ] Add ambient background music for buildings/areas beyond what already exists.
- [ ] Decide whether to build out the free-text NPC interaction system further (a live-API Python backend already exists for structured NPC chat at `backend/`).
- [ ] **Food Center energy top-up** - cheap hook (inverse of `spendEnergy`) identified this session if the Food Center category ever gets picked back up; not currently a priority (see deferral decision above).

## Paused (Hunter's Rift / King of Games / Domino City) - kept for reference, not being worked on

- Give professions (incl. Shadow Monarch) a distinct sprite/palette - `professionId` is never read by spriteGen/characterPalettes.
- Marriage-progression inconsistency between Hunter's FamilyModal (propose on first meeting) and World 3's Téa (requires relationship progression first).
- 67 of ~150 DDM monster abilities and 18 of 50 DDM items are tagged `not_implemented` in the UI.
- No win/clear condition wired for Domino City (`clearBlock('domino')`/`clearWorld4` never called).
- `recordTier4Defeat` doesn't track Tier 5 (Yugi/Kaiba) wins toward anything persistent.
- A Solo Leveling-inspired rework (multi-monster rift battles, Shadow Army extraction/Arise mechanic) was scoped in `solo-leveling-reference.md` but not built - Hunter world is currently sealed off.
- Latent bug: `clearBlock()` in `useGameStore.js` reassigns `currentBlockId` to a random *uncleared* block after Finance is cleared - since `hunter`/`yugioh`/`domino` are never cleared, `currentBlockId` can end up pointing at one of them. Currently harmless (nothing in `OverworldScene.js` reads `currentBlockId` anymore), but it's a trap for whoever wires those worlds back up.
