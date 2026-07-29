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
  **36 warnings, 0 errors** (re-measured directly:
  `npm run lint 2>&1 | grep -c "warning eslint"`. This doc previously said
  37; that was off by one. 0 errors is the part that actually matters -
  treat the warning count as "don't let it climb," not as a precise
  contract). Don't increase it.
- Double-canvas "ghosting" concern from earlier: investigated and ruled out -
  confirmed via an actual production build (`npm run build && npm run
  preview`, or `vite preview`) that exactly one canvas renders; the two seen
  in dev mode are React 19 StrictMode's intentional double-invoke, dev-only,
  never ships. Not a real bug, don't re-investigate unless new evidence
  suggests otherwise.

## PRIORITY 0 - THE "DOUBLE EXTERIOR" (next thing to do, reported by the human)

The chapel currently has **two different exteriors**, which is wrong:
1. The overworld map draws the `temple` building with a generic facade (a
   Serene-Village-style building) via `placeBuildingFacade`.
2. The courtyard zone (`chapelExterior`) draws the pack's real authored
   chapel.

The human wants **one** exterior - the authored one - shown on the map,
replacing the generic house facade.

**Why it wasn't done in the session that found it:** the authored chapel
building art (House + Wings + Dragon_body_head layers) is **16x14 tiles**.
The `temple` building def in `OverworldScene.js` (~line 119) is
`width: 4, height: 2`. Drawing 16x14 at native scale on a 4x2 footprint
overflows by ~12 tiles in both axes and would sit on top of neighbouring
Kyoto District buildings. Doing it properly means enlarging the footprint
in the def and letting `layoutFinanceMap` repack the district - which can
shift or overlap every other building in it. That needed a verification
pass there wasn't capacity for, and guessing at it would break the map.

**Suggested approach:**
1. Bump the `temple` def to roughly `width: 16, height: 14`.
2. Re-run the layout and **check the whole Kyoto District for overlaps and
   for buildings pushed off-map** before looking at anything else. The
   packer honours `gap`, so the risk is displacement, not overlap per se.
3. Only then add the facade renderer: a function in
   `src/game/interiors/tmxMapExterior.js` that draws the House/Wings/
   Dragon_body_head layers (cols 6-21, rows 2-15, 248 tiles) at the
   building's footprint, called from `placeBuildingFacade` when
   `building.id === 'temple'`. The tilesets are already preloaded in the
   overworld via `preloadChapelExterior`, so no new loading is needed.
4. Decide what the courtyard zone becomes. If the full courtyard is on the
   map, `chapelExterior` is redundant and the temple should route straight
   to `chapelInterior` again (revert the `target` routing added for it).
   If only the building goes on the map, keep the courtyard.

**Also outstanding on the chapel door (asked for, not delivered):** the
human wants a door open/close animation when entering. **The pack ships no
door-open art** - checked, there is no door/gate asset and Exterior.tmx's
152 animation entries are all dragon-wing frames. So this cannot be done
from pack art alone. Options: reuse the existing animated-door system
(`buildingDoorAnimSpec` in `tileGen.js`, currently scoped to Serene Village
cottage prefabs) if its door frames are acceptable stylistically, or do a
short fade on the door tiles as the zone transitions (a transition effect
rather than invented art). Ask which - don't fabricate chapel door frames.

## PRIORITY 1 - Finish polishing the chapel INTERIOR, then and only then the exterior

> ## ⚠️ SUPERSEDED - READ THIS BEFORE ANYTHING ELSE IN THIS SECTION
>
> **The hand-placed-room approach described in the rest of this section was
> abandoned and replaced. Do not resume it.**
>
> The chapel pack ships `Tiled_files/Interior.tmx` - **the artist's own
> composition of the exact image we were using as the reference**. Five
> rounds were spent hand-guessing furniture positions and sprite crops to
> approximate a layout that was sitting in the pack as data the whole time.
>
> The chapel now renders that file directly:
> - `src/game/packs/chapelInteriorMap.js` - generated extraction (1076
>   tiles, 21 layers, 21 tilesets). Regenerate with
>   `production/parseInteriorTmx.cjs`; do not hand-edit.
> - `src/game/interiors/tmxMapInterior.js` - draws it, owns collision and
>   the spawn/exit/desk zones (the only invented data - the authored map is
>   a display scene with no door).
> - `production/renderChapelMap.mjs` - render harness. **Verified: 1076/1076
>   tiles drawn, every tileset at expected dimensions, output compared
>   against the reference and matches.**
>
> Root causes this exposed, all of which the hand-built room got wrong:
> - Authored room is **22x17**; the hand-built one was 17x22, transposed.
> - Characters are **multi-tile compositions** (priest 2x3, parishioners
>   2x2), not single sprite frames - that is why they rendered as busts
>   with no legs.
> - The map's tilesets are the images in **`Tiled_files/`**, which are
>   different files from the same-named ones in **`PNG/`**
>   (`Walls_Interior.png` is 160x496 there vs 160x528 in `PNG/`). The old
>   code loaded the `PNG/` copies, silently mis-cropping everything.
> - The priest is drawn from `Priest_speech.png` (the arms-out pose); the
>   old code used that file as *wall alcove decoration* instead.
>
> `tmxWallInterior.js` and `chapelPixelTiles.js` are still live - `teaHouse`
> uses them, and that's the case they're still right for (no authored map to
> copy). Don't delete them; don't extend them for the chapel.
>
> **Known remaining issue, not yet fixed:** the player sprite comes from a
> different pack at a different scale (~35x64px) than this pack's characters
> (a 2x2-tile parishioner is 80x80px at TILE_SIZE 40, the priest 80x120).
> So the player will read as noticeably smaller than the congregation. The
> room can't be rescaled without breaking tile-aligned movement, so the
> options are scaling the player sprite up inside this zone, or accepting a
> cross-pack style difference. **Needs a human decision - ask, don't guess.**
>
> Everything below this box is retained as history of how the old approach
> failed. It is NOT a to-do list any more.

**Status (historical - describes the superseded hand-placed room):**

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

   **CORRECTED this round — the previous version of this section
   understated candelabra height and is wrong, do not use it.** Verified
   directly against `chapelPixelTiles.js`'s actual cell arrays (not just
   block anchor col/row) this time:
   - `candelabraColumn()` is `dr: 0..2` (3 rows), so the col-1/col-15
     candelabra anchored at `row: 3` occupies **rows 3, 4, AND 5** at col 1
     and col 15 — not just row 3. Likewise the `row: 9` pair occupies
     **rows 9, 10, AND 11**. This means rows 4 and 5 are NOT actually clear
     at the borders, contradicting what this doc said before.
   - `windowAccentColumn()` is 1 col wide (dc 0 only, dr 0..2): the 4 window
     accents at col 3/4/12/13, row 1 occupy exactly those columns, rows 1-3.
   - `alcoveFaceBlock()` is 2 cols wide (dc 0-1, dr 0-1): col 5/10, row 1
     occupies cols 5-6 and 10-11, rows 1-2.
   - `dragonMedallionBlock()` is 3 cols wide (dc 0-2, dr 0-2): the row-1
     one at col 7 occupies cols 7-9, rows 1-3; the row-7 ones at col 4/10
     occupy cols 4-6 and 10-12, rows 7-9.
   - So combining all of the above, **rows 1-3 are occupied col 3 to col
     13**, **rows 3-5 additionally have col 1/15 pinned** (candelabra),
     **rows 7-9 are occupied col 4 to col 12 plus col 1/15 pinned at row
     9-11** (candelabra overlap). Working row-by-row, the ONLY row with
     zero content touching the outer columns is **row 6** (just the
     center-only carpet + priest sprite).
   - Rows 12-16 (statues/pews/vases): statue blocks are 4 cols wide native
     (dc 0-3) at col 1 and col 12. Verified in code (`tmxWallInterior.js`,
     the `if (block.blocking)` branch right after the furniture-blocks
     loop): collision cell = `block.col + Math.floor(cell.dc * blockScale)`,
     so at `scale: 0.5` the bride statue (col 1, dc 0-3) actually collides
     on cols **1-2** (`floor(0*.5)=0, floor(1*.5)=0, floor(2*.5)=1,
     floor(3*.5)=1`), and the dragon statue (col 12, dc 0-3) collides on
     cols **12-13**. So cols 3-4 (west) and col 14 (east) are genuinely
     free in this row band — col 13 is NOT free, it's still inside the
     dragon statue's collision footprint.
   - **Practical read of the above, corrected: a meaningful stepped
     silhouette is NOT achievable as a pure `isWall()` data change with
     zero furniture moves** — only a single row (row 6) is genuinely free
     at the borders, which is too thin a notch to read as the reference's
     gothic step. To get an actual visible step, the lowest-risk real path
     is: shift the col-1/col-15 candelabra columns inward to col-2/col-14
     for the rows 3-5 and 9-11 bands, and shift the row-1/row-7
     window/medallion blocks inward by 1 column similarly, THEN narrow the
     wall in those bands to match. That is a real (small) furniture-move
     task, not a data-only one — scope it as such, don't attempt it as a
     "just edit isWall()" quick pass like this doc previously implied.

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
3. **Priest arms-out preaching pose - NOT a pack gap, this was checked and
   the art EXISTS. Highest-value quick win left on the interior.** The
   earlier "the pack only has the idle frame" claim was wrong; it was
   written without listing the pack's Priest folder. Verified on disk:
   - `PNG/Animation_packed/Priest/Priest_speech.png` - **128x144 = 4 cols x
     3 rows @32x48**, i.e. the SAME 32x48 cell size as
     `Priest_Idle_front.png` (96x144, 3x3) that `priestIdleFrame()` already
     slices, so it wires up with the identical convention: add a
     `PRIEST_SPEECH` entry next to `PRIEST_IDLE` in `chapelPixelTiles.js`
     and a `priestSpeechFrame()` next to `priestIdleFrame()`, then swap the
     `col: 8, row: 6` sprite in `CHAPEL_TEMPLE_ROOM` to use it.
   - Also available if useful: `Priest_making_spell.png` (96x96) and the
     four `Priest_Walk_*.png` sheets.
   - **The one unknown**: which of the 12 frames in the speech sheet is the
     arms-out pose. Frame 0 is the natural first guess but is unverified -
     the sheet was viewed only as a whole thumbnail, where individual frame
     poses aren't distinguishable. Render the frames and look before
     committing to an index; this is exactly the kind of thing that has
     been silently wrong before.
   - **Watch the file-name collision**: `PNG/Animation/Priest_speech.png`
     (192x96, a 16px tile grid) is a DIFFERENT file, already wired as
     `CHAPEL_KEYS.alcoveFace`. Don't confuse the two paths.
4. **Alcove portrait variety - root cause now known, and it's not simply
   "the pack lacks portraits."** The alcove "portrait" is a tile-scale crop
   of `PNG/Animation/Priest_speech.png` - i.e. it is the priest's own face
   art reused as wall decoration (that's how the pack's authored map uses
   it too). That's why every column showed "the same portrait": they're all
   frames of one character, not a set of saint portraits. So the reference's
   distinct green-haired/auburn-haired alcove figures genuinely aren't in
   this pack - but the 11 Parishioner sheets ARE 11 visibly distinct
   characters, and are a plausible substitute source for two different
   alcove faces if a tile-scale crop of one reads acceptably. Worth a look
   before accepting this as permanent.
5. **Lower-window arch accents** - still a genuine pack/layout gap (the
   accents exist, they're just omitted on the two lower windows to keep an
   already-dense layout legible). Lowest priority of the three.
6. **Get fresh human confirmation on the CURRENT state before doing more
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
   flat Tailwind borders/colors, not this pack at all yet.

   **Pack structure - surveyed and measured directly this round, so this
   step is already done:** `public/assets/packs/kenney_fantasy-ui-borders/`
   has `PNG/Default/` and `PNG/Double/` (two border weights), each with the
   same six subfolders, plus a `Vector/` folder (SVG sources, ignore for
   now). Per weight: `Border/`, `Panel/`, `Transparent border/`,
   `Transparent center/` are **32 numbered variants each**
   (`panel-000..031.png` / `panel-border-000..031.png`), and `Divider/` +
   `Divider Fade/` are **6 each**. Measured sizes: Default panels/borders
   are **48x48**, Double panels are **96x96**, dividers are **96x22**.
   - The 48x48/96x96 panel squares are almost certainly **nine-slice**
     source art (that's the standard Kenney UI convention and matches the
     "ornate carved corners, tileable edges" look of the reference) - but
     confirm the corner/edge inset by looking at one before writing slice
     numbers, don't assume 16px thirds.
   - Because this is plain PNG UI art (not a tilemap), the natural
     integration is **CSS `border-image` on the existing React/Tailwind
     modals**, NOT the Phaser renderer - much less invasive than routing UI
     through the game canvas. Start with one modal as a proof
     (`NamedNpcModal.jsx`), get confirmation, then generalize.
   - 32 variants is a lot; pick 2-3 (one neutral panel, one "important"
     panel, one divider) rather than exposing all of them.
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

   **Pack structure - surveyed and measured directly this round:** the real
   content is under `public/assets/packs/Modern_Interiors_Free_v2.2/Modern
   tiles_Free/`. It ships 16x16, 32x32 and 48x48 variants of the same art -
   **use the 16x16 set**, it matches every other pack already integrated
   here (chapel-pixel- and the Kenney packs are all 16px native, scaled by
   `TILE_SIZE/16`, see `tmxWallInterior.js`'s `tileScale()`).
   - `Interiors_free/16x16/Interiors_free_16x16.png` - **256x1424 = 16 cols
     x 89 rows** @16px. This is the furniture sheet (beds/tables/chairs/
     shelves/appliances). 89 rows is large; expect to hand-curate a small
     catalog of named multi-tile blocks from it, exactly like
     `chapelPixelTiles.js` does - same convention, don't invent a new one.
   - `Interiors_free/16x16/Room_Builder_free_16x16.png` - **272x368 = 17
     cols x 23 rows** @16px. Floors/walls/doors/windows, i.e. the
     counterpart to the chapel's `Walls_Interior.png`. This is what would
     feed a `buildTmxWallInteriorZone` room spec for a modern interior.
   - `Characters_free/` - **4 characters: Adam, Alex, Amelia, Bob**, each
     with 8 sheets. Cell size is **16x32** (not 16x16 - characters are two
     tiles tall). Full sheet `Adam_16x16.png` is 384x224 = 24 cols x 7
     rows; the single-action sheets (`_idle_anim_`, `_run_`, `_phone_`,
     `_sit_`, `_sit2_`, `_sit3_`) are 384x32 = 24 cols x 1 row.
   - **Directly relevant to the "sit down and read" persona idea: the sit
     art already exists** - three sit variants per character
     (`_sit_`/`_sit2_`/`_sit3_`), plus a `_phone_` sheet. So the sit
     mechanic is a code/state question, not an art-availability question.
     Note there's no explicit "reading a book" sheet among the 8; the sit
     poses are the closest match, so either use one of those or say plainly
     that the exact reading pose isn't in the free pack.
   - Caveat: this is the FREE version (v2.2) of a larger paid pack. If
     something the design calls for seems missing, it's likely genuinely
     absent rather than mis-indexed - check before assuming a crop bug.
3. **Character animation variety** - several newly-added packs include
   characters with real multi-action animation (chapel-pixel-'s
   Priest/Monk/Parishioner idle/walk/pray/speech sprites, Cute Fantasy's
   Player/Animals) that aren't fully exploited yet. Survey which existing
   game characters/roles could use richer animation from a pack whose art
   style actually fits them, and wire in idle/walk/action states beyond the
   current single-frame or basic-walk-cycle baseline. Lowest priority of the
   three - do last if time allows.

## Verification bar (unchanged from the rest of this session)

- `npm run build` passes, lint stays at 36 warnings / 0 errors.
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
