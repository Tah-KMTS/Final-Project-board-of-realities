# Chapel Reference — Precise Description

The human shared the pack's own marketing/store-page images (titled "CHAPEL
PIXEL ART" as a banner) as the target. **These files do NOT exist anywhere in
the downloaded `chapel-pixel-` pack on disk** (confirmed: no `Preview.png`,
`Sample.png`, or any composite image in the pack folder — checked file sizes
of every PNG in the pack, nothing matches). They are external reference
material, described here in full detail since they can't be re-attached to a
future session. Treat this as the authoritative target, more precise than any
earlier description in this repo's history (including this doc's own earlier
drafts elsewhere) — this supersedes those.

**Important framing:** this looks like a hand-composed marketing "hero shot"
combining many of the pack's individual assets in a deliberately artistic
arrangement, at a wide banner canvas size — it may be more feasible to closely
**approximate** (correct palette, correct silhouette, correct key-element
placement) than to pixel-perfectly reproduce with an algorithmic tile-grid
room builder. Say so honestly if a literal reproduction isn't achievable with
this pack's raw assets rather than forcing something that doesn't fit — but
get as close as the assets genuinely allow before concluding that.

## Interior reference (exact description)

- Floor: light blue-grey stone, subtle diamond/checker pattern, cool tone —
  NOT the current build's floor color/tile choice.
- Room silhouette: symmetric gothic shape, walls stepped outward toward the
  bottom (narrower at the top/altar end, wider at the pew end) — matches the
  exterior's roofline silhouette (see below).
- Back wall (altar end): one large centered stained-glass window — dark
  navy/red diamond shape with a **blue dragon emblem** centered in it,
  flanked by tall narrow red arched stained-glass windows (2 per side, gold/
  tan trim).
- A bright blue-white beam of light shines down from that center window,
  spilling onto the floor as a glowing blue light-strip running down the
  center aisle.
- Two small character portraits are embedded in wall alcoves near the top
  corners, just below the topmost windows (one green-haired figure on the
  left, one auburn-haired figure on the right) — like stained-glass saint
  portraits built into the wall itself, not freestanding.
- A second, lower tier of wall has two MORE dragon-emblem stained-glass
  windows (same design as the top one, smaller/lower), each flanked by pairs
  of the same thin red arch windows.
- 4 monk figures in dark brown hooded robes, heads bowed, stand in a row just
  below/beside the second-tier windows — 2 on the inner-left, 2 on the
  inner-right, positioned between the windows and the altar.
- Altar: a small wooden lectern/podium with an open white book on top,
  directly under the light beam. A priest stands at it — blue/white robe,
  pointed hood, arms out in a preaching pose.
- Gold candelabra with lit candles stand at intervals along both side walls,
  between window sections.
- **Statues, one per side, flanking the pews (NOT the altar):**
  - LEFT: a tall pale blue-white ghostly bride — full wedding dress and
    veil, hands clasped in front, praying pose, semi-transparent glow.
  - RIGHT: a large pale blue-white dragon statue, standing on hind legs,
    wings folded/slightly spread — the SAME dragon design/coloring as the
    one draped over the exterior roof (see below), mirroring the bride
    symmetrically.
- Pews: two blocks (left/right), each roughly 3 rows deep with 2 characters
  per row visible from behind (~6 per side, ~12 total). Heads are
  deliberately varied in species/style: a metallic/robotic head, a green
  orc/goblin head, plain human heads in several hair colors (brown, dark,
  blonde, red/orange, white/pale), a dark hooded/shadow figure, a horned
  demon-like head. The point is visible variety, not uniform congregants.
- Flower vases (blue/purple flowers) sit at the outer ends of each pew
  block, near the side walls.
- Palette overall: cool blue/white/cream for architecture and lighting, warm
  brown for wood (pews, lectern, monk robes), deep red/maroon for stained
  glass and roof-adjacent trim, gold for candelabra and window trim.

## Exterior reference (exact description) — this needs FAR more work than a
## color/label change, be honest about that scope with whoever picks this up

- A symmetric gothic chapel viewed at a 3/4 elevated angle (not pure
  top-down), on a tan/brown dirt courtyard.
- White/cream stone facade, twin corner towers each capped with a red
  conical roof, a larger central red-tiled peaked roof with a round
  blue-and-gold rose window below the peak, a small cross/finial on top.
- Tall arched red stained-glass windows flank a central ornate double door
  (dark brown/maroon, round window above), all in pointed gothic-arch stone
  trim.
- A large blue-white dragon — the same one as the interior statue — is
  draped OVER the roof: wings spread across both roof sections, neck/head
  curling down over the left peak, tail curling down the left side of the
  building to the ground. It reads as perched on/guarding the chapel.
- A small graveyard flanks both sides of the building: a 2x2 grid of grey
  tombstones per side (8 total), each plot bordered and planted with
  colorful flowers (red/blue/purple/yellow) in the dirt.
- A black wrought-iron fence borders the whole courtyard, with ornate lamp
  posts (black, glowing top) at intervals, plus a decorative iron gate
  section directly in front of the main doors.
- Green hedges border the top edge, with grey cobblestone paving visible
  beyond them (implying the chapel sits in a larger town square).
- The building's silhouette (viewed from outside) matches the interior
  room's stepped wall shape exactly — same "house with two wings" outline.

**Why this is a bigger ask than it sounds:** the live overworld map currently
represents every building (including this one) as a simple tinted rectangle
via `placeBuildingFacade`, optionally reskinned with a pack-based nine-slice
or prefab facade (see `src/game/packs/packRender.js`). A previous round only
recolored/relabeled that flat rectangle for this building — it did not attempt
anything like "a dragon draped over the roof with a graveyard courtyard,"
which is a substantially more detailed illustrated scene than the flat-facade
system currently produces for ANY building in the game. Scope this
realistically: check whether the chapel pack's `Exterior.png`/`Exterior.tmx`
(already known to exist, `Tiled_files/Exterior.tmx`, ~92KB) can drive
something closer to this via the same TMX-parsing approach used for the
interior, before assuming a from-scratch custom render is needed.

## What the human specifically flagged as still wrong (their words, paraphrased minimally)

- "the tile looks different" — floor/wall tile choice doesn't match this
  reference's cool blue-grey palette.
- "the layout is different" — room/object arrangement doesn't match the
  above description (verify pew block count/depth, monk positions, window
  tiers, statue placement against this doc precisely).
- "person was split in half" — a character or statue sprite is rendering
  visibly cut/cropped, distinct from the earlier (already-fixed) statue
  crop bug. Find which figure and why — check every crop/frame boundary
  used for character/statue sprites again, don't assume the earlier fix
  covered every instance of this class of bug.
- "much more" — there are additional unstated gaps; get fresh human
  confirmation after the next attempt rather than assuming this list is
  exhaustive.
- "the color scheme is different" — general palette mismatch, likely
  downstream of the wrong tile/window choices above.
