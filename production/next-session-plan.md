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

**Structural/count verification is not visual verification.** The chapel
interior was originally reported "verified" via exact `zoneObjectsCount`
matches, BFS reachability, zero exceptions - all true, and the room still
rendered as scattered tile fragments on a black void with random props
instead of people. Passing counts proves internal self-consistency, not that
the output looks like anything. Don't call visual work "done" on structural
evidence alone - say "ready for confirmation" instead, every time.

**Update - a real fix for this WAS found, use it as the default now:** the
interactive Browser preview pane cannot composite frames in this environment
(confirmed dead end, don't retry it) - but a **Vite dev server + `puppeteer`
(already a project devDependency, no new deps) screenshotting the canvas
directly via CDP, inside a temporary throwaway harness, works.** This is how
all 4 chapel iterations below actually got real pixel evidence: build a small
script that starts the dev server, drives the actual `buildTmxWallInteriorZone`
(or whatever real code path) inside a headless Chromium tab, screenshots the
canvas, saves a PNG, then **view that PNG yourself** before claiming anything
about how it looks. Clean up the harness script when done (keep the repo's
`git status` limited to real source changes) but **save the final PNG
somewhere durable** (this session used
`<scratchpad>/chapel/chapel_v1..v4.png`) and hand the exact path back up so it
can be sent to the human directly via a file-send tool - that's faster and
more reliable than asking the human to boot the game themselves first, though
the human's own live-game confirmation is still the final word once they get
to it.

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

## PRIORITY 1 (top of next session) - Finish polishing the chapel INTERIOR, then and only then the exterior

**Status: substantially rebuilt and much improved (commit `5d64638`,
`git log` for the full message), four iterations deep, human has seen and
responded to real renders each time (not just structural claims). This is
NOT the same broken state described further down this doc's revision
history - do not re-read this as "still totally broken," read the current
code and the human's actual most recent feedback below instead.**

Do this work directly in `src/game/interiors/tmxWallInterior.js`
(`CHAPEL_TEMPLE_ROOM`, currently 17 cols x 22 rows) and
`src/game/packs/chapelPixelTiles.js`. **Read the "Known gaps vs. the
reference" comment block directly above `CHAPEL_TEMPLE_ROOM` in
`tmxWallInterior.js` first** - it is a precise, current, honestly-written
list of every remaining known gap, written by the agent that did the last
fix pass, not stale documentation. `production/chapel-reference.md` remains
the authoritative visual target (the pack's own marketing images, described
in full detail there since the image files aren't in the downloaded pack).

**The human's last two rounds of feedback, in order:**
1. First pass ("v2"): "still doesn't look like the picture... the tile looks
   different, the layout is different, person was split in half... the color
   scheme is different" - all four of these were root-caused and fixed (see
   commit `5d64638`'s message for the specific bugs: transparent floor tiles,
   a statue crop that discarded half the art, a portrait crop that only
   grabbed half its width, a rug stuck on one frame instead of the pack's
   real 8-frame sequence, a "flower vase" that was actually cropping a
   necklace icon).
2. Second pass ("v4", latest): "scale it properly because be aware of the
   other person in the game... interior is much better but not quite there
   yet... the rug on the floor feels wrong... amongst other things." Scale
   was recalibrated against the player's real on-screen size (~35x64px,
   verify this yourself from `src/game/spriteGen.js`/`playerSpriteArt.js`
   rather than trusting this number blindly - it was independently
   re-derived and confirmed once already, but re-derive again if anything
   about the player sprite has changed). The rug bug (single repeated frame)
   was found and fixed. **No response yet from the human on whether v4 is
   good enough** - if you're picking this up fresh, treat v4
   (`chapel_v4.png`, may or may not still exist depending on scratchpad
   cleanup - regenerate via the render harness if not) as your current
   baseline, not confirmed-final.

**Concrete remaining gaps to close, in the order they're likely to matter most:**

1. **The room's stepped/gothic wall silhouette - deferred twice now, do it
   this round if at all feasible.** Reference shows narrower walls at the
   altar end (top, low row numbers), wider at the pew end (bottom, high row
   numbers), matching the exterior roofline. Currently `isWall()` is a plain
   rectangle (`col === 0 || col === 16 || row === 0 || row === 21`), room is
   17 cols x 22 rows.

   **Exact current furniture column usage per row band, read directly from
   `CHAPEL_TEMPLE_ROOM.blocks`/`.sprites` in `tmxWallInterior.js` (lines
   ~343-407) so the next session doesn't have to re-derive this:**
   - Row 1 (top windows/alcoves): blocks start at col 3, 4, 5, 7, 10, 12, 13
     - `windowAccentColumn()`/`alcoveFaceBlock()`/`dragonMedallionBlock()`
       widths aren't confirmed from position alone, check their cell-array
       widths in `chapelPixelTiles.js` before picking a boundary, but the
       rightmost visible start col is 13, so a wall boundary tighter than
       roughly col 2 / col 14 for this row band is the risk zone.
   - Rows 3, 9: candelabra columns at col 1 and col 15 (`candelabraColumn()`)
     - these are the OUTERMOST placed content in the whole room after the
       col 0/16 border itself - any stepped narrowing that affects rows 3 or
       9 must not clip col 1 or col 15.
   - Rows 7-9 (second-tier windows/monks): col 4, 10 (`dragonMedallionBlock`
     at row 7), cols 5,6,10,11 (monks at row 9).
   - Rows 12-16 (statues/pews/vases): col 1 and col 12 (statue blocks,
     4-wide native = cols 1-4 and 12-15, but rendered at `scale: 0.5` per
     the code comment - the VISUAL footprint shrinks but check whether the
     collision footprint referenced in that comment, "collapsed to match
     the shrunk visual bounds," actually frees up cols 3-4/13-14 for a
     narrower wall here, or if it's still anchored at the original col 1/12
     origin), cols 5,10 (pews/vases).
   - Rows 4-19, cols 7-9: carpet aisle (center, unaffected by any side-wall
     change).
   - Row 6, col 8: priest (center, unaffected).
   - **Practical read of the above:** the row band that could most safely
     get a narrower wall without moving anything is roughly rows 1, 4-6
     (top/altar area, nothing currently placed outside cols 3-13ish there)
     - candelabra at rows 3 and 9 are the hard constraint pinning col 1/15
       as the minimum width for THOSE specific rows. A shape that's
       narrower only where rows 1/4-6 don't overlap rows 3/9 (i.e. actually
       just row 1 and rows 4-6, stepping back out to full width by row 7)
       would be the lowest-risk version - still a visible step, still
       requires zero furniture moves, but modest. Widening the narrow band
       to also cover rows 7-9 would require moving the row-7
       `dragonMedallionBlock` and row-9 monks/candelabra inward first.

   Suggested approach either way: define the new shape as a simple data
   table (e.g. an array of `{rowStart, rowEnd, colMin, colMax}` bands),
   redraw ONLY the walls against it, render and view that in isolation
   before touching any furniture, THEN move anything that now falls in a
   wall band as a clearly separate step. Re-run BFS reachability after the
   wall change specifically (before any furniture adjustment) so a wall-only
   regression is never bundled with a furniture-move regression - if
   something breaks, this keeps it obvious which change caused it.
2. **Statue collision footprint is still a rectangular approximation** of an
   irregular silhouette (noted honestly in the code comment) - lower
   priority than the wall shape, only worth polishing if there's a
   noticeable "bumping an invisible wall" issue once a human actually walks
   around in there.
3. **Alcove portraits, lower-window arch accents, priest pose** - all three
   are pack-asset-availability gaps (the pack doesn't have the specific
   variant needed), not code bugs. Don't force a fabricated fix - either
   accept these as permanent limitations of this specific asset pack, or
   spend a little time checking whether ANY other already-integrated pack
   (Cute Fantasy, Serene Village, etc.) happens to have a usable substitute
   before giving up on them.
4. **Get fresh human confirmation on the CURRENT state before doing more
   speculative polish** - if you land any fix, produce a new render, show
   it, and wait for actual feedback rather than guessing at further gaps
   the human hasn't mentioned.

**Only once the human confirms the interior is genuinely good** (not just
"better"), move to the exterior. That work is unstarted but well-scoped
already: `Tiled_files/Exterior.tmx` (~92KB) has exactly the layers described
in `production/chapel-reference.md`'s exterior section (`House`, `Fence`,
`Graves`, `Flowers`, `Wings`, `Dragon_body_head`, `Grass_Walls`/
`Grass_details`, `Floor`/`Floor_details`, across 7 tilesets, one with 1225
tiles) - the same TMX-parsing approach used for the interior should work,
but parsing 9 layers/7 tilesets and assembling a 3/4-angle illustrated scene
(dragon draped over the roof, graveyard, wrought-iron fence) is a
substantial task on its own. Don't rush it in alongside interior polish.

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
