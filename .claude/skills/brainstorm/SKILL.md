---
name: brainstorm
description: "Quick guided ideation for a new mechanic, encounter, or feature in Board of Realities - grounded in the actual worlds/systems that already exist, not a from-scratch game concept."
argument-hint: "[what you're brainstorming, e.g. 'a new Financial Anarchy encounter']"
user-invocable: true
allowed-tools: Read, Glob, Grep, AskUserQuestion
model: sonnet
---

This project already has a shipped game (3 worlds, Zustand store, Phaser scenes, combat/duel/DDM engines) - this skill is for ideating a *new piece* of it, not the whole concept.

## 1. Ground in what exists

Read `src/store/useGameStore.js` (skim world sub-objects) and grep for related existing content in `src/features/` for the world named in the argument. Note what patterns/contracts already exist that a new idea would need to fit (e.g. the `{ onClose, onVictory, onDefeat }` combat contract).

## 2. Ask, don't assume

Ask 1-2 sharp questions about what the idea needs to accomplish (new content? new mechanic? filling a gap noticed during play?). Use `AskUserQuestion` if there's a genuine fork in direction, plain conversation otherwise - don't over-ceremony a small idea.

## 3. Present 2-3 concrete options

For each: one-sentence pitch, which world/system it belongs to, what existing pattern it reuses, and the single biggest risk (balance, scope, or technical). No elevator-pitch tables, no MDA framework write-up - keep it short enough to read in 10 seconds.

## 4. Hand off

Once the user picks a direction, say plainly which agent should take it next:
- Needs balance/mechanics thinking first → `game-designer`
- Ready to build → `gameplay-engineer`
- Needs dialogue/flavor text → `writer`
- Should go in the backlog instead of now → `producer`

No files are written by this skill - it's a conversation, not a document pipeline.
