# Backlog

## Hunter World
- [ ] Give professions (incl. Shadow Monarch) a distinct sprite/palette in the overworld - `professionId` is never read by spriteGen.js/characterPalettes.js, so every hunter looks identical regardless of class
- [ ] Decide whether marriage should require any relationship progression - FamilyModal lets you propose on the very first meeting, unlike World 3's Tea (which needs `advanceTeaRelationship` first) - inconsistent pacing between worlds

## Financial Anarchy
- [ ] Add ambient background audio for this world - only Hunter's Rift has an ambient loop (`audio/hunterAmbient.js`); Financial Anarchy, Yu-Gi-Oh, and Domino City are silent outside SFX

## Yu-Gi-Oh / DDM
- [ ] Wire up remaining DDM monster abilities tagged `not_implemented` - 67 of ~150 dragon/machine/magic abilities across the three series files show in the UI as "flavor only - not yet active" with no working action button
- [ ] Wire up remaining DDM items tagged `not_implemented` - 18 of 50 items in `ddmItemCatalog.js` (traps/spells/equipment/artifacts) are visible in the shop UI but marked "not yet active" and can't be used
- [ ] Define and wire a clear/win condition for the Domino City block - `clearBlock('domino')`/`clearWorld4` are never called anywhere; defeating Kaiba (Tier 5, the de facto final boss behind the tournament gate) just pays out DP like any other duel, so this world can never be "cleared" like the other three
- [ ] Remove or actually use `world3.tahRpsVetoAvailable` / `setTahRpsVeto` in the store - dead scaffolding; the real Tah RPS-veto encounter reimplemented the same idea with local component state (`vetoOffered` in TahEncounterModal.jsx) instead
- [ ] `recordTier4Defeat` only tracks Tier 4 duelist wins (for the "expert pack" unlock) - decide if Tier 5 wins (Yugi, Kaiba) should count toward anything, since right now beating them leaves no persistent trace beyond `totalWins`

## Cross-world
- [ ] No automated test coverage anywhere in the repo (no test files, `npm run lint` is oxlint only) - all regression checking is manual playtesting
- [ ] No persistent end-of-game summary/epilogue - "ALL BLOCKS CLEARED" just returns to the title screen with no recap of what happened across the run
