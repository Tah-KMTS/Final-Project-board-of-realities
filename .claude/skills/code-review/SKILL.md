---
name: code-review
description: "Reviews changed files in Board of Realities against this project's actual conventions (Zustand store shape, Phaser scene shape, combat-modal contract, no-external-assets rule) - not generic SOLID/architecture checklists."
argument-hint: "[path-to-file-or-directory, or omit for currently changed files]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash
model: sonnet
---

## 1. Get the diff

If no path given, run `git diff` (and `git diff --stat HEAD` if nothing staged/unstaged) to find what changed. Otherwise read the given path(s) in full.

## 2. Check against this project's actual rules, not generic ones

- **Store**: all state in `src/store/useGameStore.js`, actions grouped by world under a `// --- World N: ... ---` comment header. Flag any new separate store.
- **Scenes**: new/changed Phaser scenes should follow the shared shape (`buildLayout → isBlockedTile → drawTerrain → ... → update → updateNearbyZone → triggerInteraction`). Flag deviation without a stated reason.
- **Movement**: grid-locked via `TileMover` - flag any reintroduced Arcade Physics velocity movement for the player.
- **Combat/mini-game contract**: `{ onClose, onVictory, onDefeat }`, caller decides closing. Flag any component that auto-closes itself on outcome.
- **No external assets**: sprites/tiles/audio are all procedural (`spriteGen.js`, `tileGen.js`, `sfx.js`, `themeSong.js`). Flag any new `.png`/`.mp3`/`.wav` import outside `src/assets/hero.png` (existing exception).
- **Scale consistency**: if new combat/duel numbers were added, check they match the scale of the system they're in (Yu-Gi-Oh ~8000 LP vs DDM ~3 HP) rather than being copy-pasted from elsewhere.
- **em vs rem**: flag any new `em`-based font-size on a reusable class (known compounding trap, see `visual-polish` agent notes).

## 3. Sanity gate

Run `npm run build` (and `npm run lint` if relevant files changed). Report pass/fail plainly - don't call something reviewed if the build wasn't actually run.

## 4. Output

```
## Code Review: [files]

### This project's conventions: [CLEAN / ISSUES]
[specific violations with file:line]

### Build: [PASS / FAIL - paste error]

### Suggestions
[optional, non-blocking]

### Verdict: [APPROVED / CHANGES REQUESTED]
```

No files written. If CHANGES REQUESTED, say which existing agent should fix it (`gameplay-engineer` for logic, `visual-polish` for presentation).
