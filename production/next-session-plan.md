# Next-Session Plan: Asset Pack Integration (continued)

**Written:** end of a long session integrating real Kenney/community asset packs
(vehicles, town tiles, chapel) into a previously-procedural-only renderer.
**Trigger phrase:** the human will just say "continue the work, same setup" -
this doc is what that means. Team structure: one Sonnet-level manager
(not Opus - cost-conscious, established this session), which spawns a small
number (3-4 max) of Sonnet/Haiku workers as needed, reviews their output
strictly (real evidence, not trusted claims), and reports back with an honest
finished/not-finished list every round. This is an ongoing experiment - **do
not commit or push without the human's go-ahead**; everything up to this
commit is already pushed, so the rollback point is always available via
`git log`.

## THE ONE CRITICAL LESSON FROM THIS SESSION - READ FIRST

**Structural/count verification is not visual verification, and this session
learned that the hard way.** The chapel interior was reported "verified" with
very convincing evidence - exact `zoneObjectsCount` matches between a
standalone script and the live scene, BFS reachability proofs, a full
zone-round-trip test with zero exceptions. All of that was true. The room
still rendered as a scattered mess of disconnected red tile fragments on a
black void, with random loot props (a skull, a trophy, a hammer) sitting on
benches instead of seated characters - nothing like a coherent room, let alone
the reference image. **Passing counts and having no exceptions thrown proves
internal self-consistency, not that the output looks like anything.** This
environment cannot reliably capture live screenshots (confirmed multiple times,
by multiple agents AND by the human's own primary session directly - the
Browser preview pane does not composite frames here, screenshots time out
universally, not just for one automation approach). Given that hard
constraint, the only reliable path to visual correctness this session found is:
**the human plays the actual game and reports what they see, with real
screenshots pasted into chat**, which the orchestrating session CAN view (image
files/pasted images work fine via the Read-equivalent path - it's live browser
rendering specifically that's broken). Budget for this: don't call ANY visual
integration "done" until the human has actually looked at it, no matter how
good the structural evidence is. Say so explicitly in every report ("verified
structurally, NOT visually confirmed") rather than letting confident-sounding
counts imply more than they prove.

## STATUS: what's actually done and confirmed good (don't redo)

All of the following passed both structural verification AND the human's own
live playtest (screenshots reviewed, explicit approval or no further
complaint) - safe to build on top of, not to re-litigate:

- **Vehicles**: real drivable cars (enter/exit/drive/theft), uniform sizing
  across all types (`VehicleActor.js`'s `UNIFORM_VEHICLE_WIDTH` auto-scale),
  correct top-down orientation for every driveable vehicle including the
  atmosphere/atmosphere fleet (police/ambulance/taxi/van/suv/sedan -
  `pico8CarFrameFor()` in `vehicleGen.js`), and exact position persistence
  across zone reloads (a stolen/owned car stays exactly where you parked it -
  `updateOwnedVehiclePosition` in the store, `restoredTile()` in
  `spawnWorldVehicles()`).
- **Collision**: trees/rocks, water, and parked vehicles all correctly block
  movement now (`OverworldScene.js`'s `isSingleTileObstacle` helper, shared by
  `isBlockedTile` and `resolveOpenPosition`). Note the player's own
  `DEFAULT_SPAWN` tile had to be kept out of the water band for this to work -
  see the comment above `WATER_ROWS` if touching that area again.
- **Building variety**: `kenney_pico-8-city` (warehouse/manor prefabs) and
  `SERENE_VILLAGE_REVAMPED` (3 cottage colors + animated doors, scoped to just
  the buildings using that style) both landed as additional home-variety
  options alongside the original tiny-town/modern-city facades, all verified
  as real fixed-size assemblies (not guessed) via actual rendered crops.
- **Cute Fantasy Free**: animal pens (chickens/cows/pigs/sheep) near
  appropriate terrain, wealth-gated to some homes as a flavor detail, reusing
  the existing ambient-NPC wander/collision pattern rather than a new system.
- **The "Whispering Temple Chapel" ROUTING is correct** - walking up to the
  temple building in Kyoto District and pressing E genuinely loads a real
  interior, the desk interaction genuinely opens `TempleModal`, confirmed
  through the full live walk-up-and-interact flow, not just a code-level
  test. The building's exterior color/label were also updated so it reads as
  distinct from a generic Kyoto building. **Only the INTERIOR'S CONTENTS are
  broken (see below) - the wiring/plumbing around it is fine.**
- Baseline to preserve: `npm run build` passes, `npm run lint` is
  **37 warnings, 0 errors**. Don't increase it.
- Double-canvas "ghosting" concern from earlier: investigated and ruled out -
  confirmed via an actual production build (`npm run build && npm run
  preview`, or `vite preview`) that exactly one canvas renders; the two seen
  in dev mode are React 19 StrictMode's intentional double-invoke, dev-only,
  never ships. Not a real bug, don't re-investigate unless new evidence
  suggests otherwise.

## PRIORITY 1 (top of next session) - Rebuild the chapel interior for real

**The human's own words, with a screenshot of the actual result:** *"whispering
temple look nothing like the reference picture i showed you both interior and
exterior."*

What the screenshot actually shows: a black background with scattered,
disconnected red rectangular tile fragments (no coherent wall/floor
structure), a single white ghost/bride statue (this ONE element from the
reference DID land), a blue-robed figure and two smaller brown-robed figures
near an altar-like table, three pairs of plain brown benches down the sides -
each bench has a random unrelated prop sitting on it (a hammer, a skull, an
orange fruit-like object, a trophy, a dark orb, a white urn) instead of a
seated character, and two small pale crescent shapes on the side walls. No
center aisle, no stained glass windows, no dragon statue, benches aren't
populated with seated Parishioner sprites, walls don't read as walls.

**The original reference image** (described in full since it can't be
re-attached here, but was given directly to a previous round of this session):
a grand chapel interior, a blue-lit carpet aisle running down the center,
pews FULL of many different seated parishioners (visibly different
colors/species) on both sides facing an altar, a robed priest standing at an
ornate altar under a large red dragon-motif banner, tall arched stained-glass
windows along the side walls, lit candelabras between the windows, a ghostly
bride-like statue flanking one side of the altar and a large blue dragon
statue flanking the other, and two small figures visible in wall alcoves
above the altar.

**What to actually do:**
1. Re-read `src/game/interiors/tmxWallInterior.js` and
   `src/game/packs/chapelPixelTiles.js` (the two files from earlier this
   session) in full. Given the visual result, treat their catalogued frame
   indices as UNVERIFIED despite prior claims of visual confirmation - the
   assemble-and-render step that would have caught "this renders as scattered
   fragments, not a wall" either wasn't actually done, or wasn't looked at
   carefully. Redo that check: actually assemble a test region and view the
   PNG before trusting any index.
2. The floor/wall background is the first thing to fix - right now there
   appears to be NO wall/floor tile layer rendering at all (black void), only
   floating decoration on top of nothing. Check whether the TMX parsing logic
   is actually placing `Walls_Interior.png` wall/floor tiles per-cell, or only
   placing furniture/prop objects and skipping the base layer entirely - the
   evidence strongly suggests the latter.
3. The pews need actual seated character sprites (the pack's `Parishioner1-11`
   variants, per the original catalog) at the bench positions, not props. If
   props ended up on the pews instead of characters, that's a data/wiring
   mixup worth finding directly (did prop placement and parishioner placement
   get swapped, or did parishioner placement never get wired at all and
   something else filled those tiles instead?).
4. Add the missing reference elements if the pack actually has the assets for
   them (stained glass windows, the dragon statue as the SECOND flanking
   figure - the pack's `Dragon_body/head/tail/wing_animation.png` files exist
   and were catalogued as available; a carpet-aisle floor accent - the prior
   report mentioned a `carpetTile()` existing in the catalog but never wired
   into the per-cell floor loop, which is a likely quick win). If a specific
   reference element genuinely has no matching asset in the pack, say so
   honestly rather than fabricating a tile index - this project's established
   convention throughout this session is to admit a gap rather than guess.
5. **Do not mark this done on structural counts alone.** Get the human to
   look at it again before calling it finished this time.
6. Also check: the interior's on-screen title reads "Whispering Temple" in
   the human's screenshot, not "Whispering Temple Chapel" as the exterior
   building def was supposedly relabeled to - if the interior's region label
   is a separate string that didn't get updated to match, fix that
   consistency gap too.

## PRIORITY 2 - Trees rendering incomplete

Reported with a screenshot (teal/cyan spiky tree shapes on small orange/brown
bases, near a road, looking visually wrong/cut-off in some way not yet
precisely characterized). A previous round investigated the geometry
(frame-index math, multi-tile placement) and found it internally consistent
with the pack's documented layout, but could not get a real screenshot to
compare against what the human actually saw - the same Browser-pane
compositing limitation described above. Likely candidate source:
`kenney_tiny-town`'s tree catalog in `src/game/packs/tinyTownTiles.js`
(`trees.green`/`trees.autumn`, single-tile entries at indices `[5,16,20,7,6]`
and `[3,9,10,21,23]`) - the color description (teal-ish) is a plausible but
unconfirmed match to that pack's "green" family. Do not assume this is the
right file without checking - `rpgUrbanTiles.js` also has its own `trees` key
and hasn't been ruled out.

**Ask the human for a fresh screenshot at the start of this work** (ideally
saved as an actual file/attachment, since that can be read directly as a
reference image, unlike live rendering) and compare pixel-for-pixel against
whichever tree catalog is the actual source before changing anything.

## PRIORITY 3+ - Never started this session, queued behind the above

These were explicitly deprioritized behind "finish the leftover work first"
and genuinely have zero progress:

1. **`kenney_fantasy-ui-borders`** - improve the game's UI (HUD, modals,
   buttons) using this pack's ornate border/panel assets. Reference image was
   shown directly to a previous round: an elegant fantasy quest-dialog panel
   with ornate corner-carved borders, a "Accept quest" button, inventory
   slots (sword/book/crown icons with counts), a "Location discovered"
   banner with sword-flourish dividers, and a "Continue / New game / Options"
   menu list. The game's current UI (`NamedNpcModal.jsx` and friends) uses
   flat Tailwind borders/colors, not this pack at all yet. Survey the pack's
   actual folder structure first (not done yet this session) before planning
   the integration.
2. **`Modern_Interiors_Free_v2.2`** - real furniture (beds, tables, chairs)
   for building interiors, with a personality tie-in: "if character persona
   likes to sit down and read a book, here are the resources that can make
   that happen" - i.e. characters should be able to sit at furniture,
   possibly gated by existing disposition data
   (`characterDispositions.js`). Reference image shown directly to a previous
   round: a multi-room building (ambulance bay, a stocked supply room with
   shelves, a staff break room with vending machine and seating, patient
   rooms with beds, a reception desk with staff and a waiting area with
   chairs) - i.e. genuinely differentiated rooms per purpose, not one
   generic room reskinned. The human explicitly said this "align[s] with
   chapel interior" in design direction - meaning whatever
   multi-room/furniture system gets built for the chapel (Priority 1 above)
   should generalize to this too, not be built twice. **Sequence Priority 1
   before this one for exactly that reason.** Also: this pack's scope may
   overlap with a SEPARATE handoff already given to a different collaborator
   in this repo - see `production/handoff-interiors.txt` - worth checking
   whether that work has progressed and coordinating rather than duplicating.
3. **Character animation variety** - several newly-added packs include
   characters with real multi-action animation (chapel-pixel-'s
   Priest/Monk/Parishioner idle/walk/pray/speech sprites, Cute Fantasy's
   Player/Animals) that aren't fully exploited yet. Survey which existing
   game characters/roles could use richer animation from a pack whose art
   style actually fits them, and wire in idle/walk/action states beyond the
   current single-frame or basic-walk-cycle baseline. Lowest priority of the
   three - do last if time allows.

## Verification bar (unchanged from the rest of this session)

- `npm run build` passes, lint stays at 37 warnings / 0 errors.
- Real rendered/assembled evidence for any tile-index or multi-tile-assembly
  claim - and per the lesson at the top of this doc, that means an actual
  viewed image, not just a passing count.
- Re-run the building-layout invariants (0 overlaps, 0 out-of-bounds, all
  reachable via BFS from spawn) if `FINANCE_BUILDING_DEFS` or building
  geometry is touched at all.
- Get the human's own eyes on anything visual before calling it finished -
  this is now a hard requirement, not a nice-to-have, given what happened
  with the chapel.

## Constraints (unchanged)

No commit, no push without explicit go-ahead - the human decides when to
commit accumulated work. Don't touch anything under `public/assets/packs/`
(read-only source material). No new npm dependencies.
