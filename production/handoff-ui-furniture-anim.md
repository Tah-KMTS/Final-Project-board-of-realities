# Handoff: UI Reskin + Interior Furniture/Sit + Character Animation

**For:** teammate picking up the presentation workstream
**From:** the Capital Syndicate / world-simulation workstream
**Repo state at handoff:** `main` @ `f977a0f`, working tree clean, build green,
`npm run lint` = **37 warnings, 0 errors**

## How to use this

Everything below the `---` line is a single prompt. Copy it all and paste it
into Claude Code opened at the repo root. It is self-contained — architecture
facts, measured asset numbers, the verification bar, and the team structure are
all baked in so the agent doesn't spend a cycle rediscovering them.

Three tasks are in scope, deliberately together because they share the same
asset pack and the same "does it actually render" verification problem:

- **Task 1** — reskin the UI with `kenney_fantasy-ui-borders`
- **Task 2** — real furniture in interiors + a sit mechanic
- **Task 3** — character animation variety (NPCs are static frames today)

This is a **sibling** of `production/handoff-interiors.md`, not a replacement.
That document owns NPCs-indoors and per-building interiors. **If both are being
worked at once, coordinate: Task 2 here touches interior rendering, which that
handoff's Task 2 rewrites wholesale.** Land the interiors work first, or scope
this one to furniture *within* whatever room system exists at the time.

---

You are the **MANAGER (Opus)** for a presentation-layer feature build in this repo.

# TEAM STRUCTURE (mandatory — the human running this asked for it explicitly)

Three tiers. You are the top.

- **You, the Manager (Opus).** Plan, decompose, delegate, adjudicate. You do
  **not** write the bulk of the implementation. You are the **strictest**
  reviewer in the chain — stricter than your supervisors.
- **Supervisors (Sonnet).** Spawn with `Agent`, `subagent_type: "general-purpose"`.
  Very strict. One per workstream (so: one for UI, one for furniture/sit, one
  for animation). Each owns their stream's correctness and reviews their own
  workers before anything reaches you.
- **Workers (Haiku).** Many, underneath the supervisors. Narrow, well-specified
  units of work.

## The strictness mandate (this is the point of the structure)

Reject work that is *plausible* rather than *demonstrated*. The specific failure
mode to hunt: **a metric that could not have come out any other way.**

Worked example from a previous session — a worker "verified" a collision change
by measuring footprint intrusions *after* the collision guard had already run.
The answer is trivially always zero. The number was real, the measurement was
real, and it proved nothing.

So of every metric a worker reports, ask: **could this number have come out any
other way?** If not, it is not evidence. Send it back.

Second failure mode, learned expensively in the session that produced this
handoff: **`npm run build` passing is not visual verification.** A rendering
change can compile, lint clean, and draw nothing. Three separate terrain
optimisations shipped "verified" this way and all three rendered a blank ground.
See the verification bar below for the harness that exists to prevent it.

# THE REPO

React + Vite + **Phaser 4** + Zustand + Tailwind v4. Game code in `src/game/`,
React UI in `src/features/` and `src/components/`.

## Conventions that are enforced here

- **House-rule comments.** When you simplify, deviate, or hit a pack limitation,
  say so in a comment at the site, with the reason. The codebase is full of
  these and they are load-bearing — several bugs this session were found by
  reading one and noticing it had gone stale.
- **No silent guessing about art.** Frame indices, tile sizes and sheet layouts
  are *measured* from the actual files, never inferred from a filename. Every
  time this rule was broken it cost a round trip.
- Don't increase the lint warning count (currently 37). 0 errors is the part
  that matters.
- **Do not commit or push** — the human handles that.

# CURRENT STATE (facts — do not rediscover these)

## What the renderer actually does now

`USE_PROCEDURAL_GRAPHICS = true` in `src/game/tileGen.js`, but this is **no
longer** an all-procedural renderer — that was true in an older handoff and is
now wrong. Real art packs are wired in and additive:

- Ground is `Cute_Fantasy_Free` grass/path tiles with autotiled road edges
  (`src/game/packs/cuteFantasyTerrain.js`).
- Trees are Cute Fantasy oaks; buildings use several Kenney facade families.
- Vehicles use `TopDown Vehicles v1.17` per-heading art
  (`src/game/packs/topDownVehicles.js`).
- The chapel renders its pack's own authored Tiled maps
  (`src/game/packs/chapelInteriorMap.js` / `chapelExteriorMap.js`).

The procedural Graphics pass still draws water, walls, and the interior rooms.

## Interiors as they exist today

Generic interiors are a **12x9 checkerboard room with a single desk rect**,
identical for every building apart from two floor colours and the label — a
steel mill, a mob hideout and a mansion all look the same. `drawInteriorRoom`
lives in **`tileGen.js`**, not `OverworldScene.js`.

The chapel is the one exception and is worth reading as the model for
"interior built from real authored data": `src/game/interiors/tmxMapInterior.js`.

## Performance — read before adding draw calls

The overworld runs ~45 fps after this session's terrain work (was 20). The win
came from collapsing per-tile Game Objects into per-row `TileSprite` runs. There
is a hard lesson recorded at `cuteFantasyTerrain.js`'s grass-run comment:

> Phaser 4's `RenderTexture` is an `Image` wrapping a `DynamicTexture`.
> `rt.beginDraw`/`rt.batchDraw` **do not exist**, and both `rt.draw()` and
> `rt.texture.draw()` **silently leave the surface empty**. Three attempts
> failed this way.

If you batch anything, verify it renders. Do not trust a green build.

# ASSETS — measured this session, use these numbers

## `kenney_fantasy-ui-borders` (Task 1)

`public/assets/packs/kenney_fantasy-ui-borders/`

- Two border weights: `PNG/Default/` and `PNG/Double/`, same six subfolders each.
- Per weight: `Border/`, `Panel/`, `Transparent border/`, `Transparent center/`
  are **32 numbered variants each** (`panel-000..031.png`).
- `Divider/` and `Divider Fade/` are **6 each**.
- `Vector/` holds SVG sources — ignore for now.

These are **nine-slice** panels. Do not stretch them naively; corners must stay
unscaled or the ornament distorts. CSS `border-image` with a slice value is the
natural fit for the React UI and avoids touching Phaser at all.

## `Modern_Interiors_Free_v2.2` (Tasks 2 and 3)

`public/assets/packs/Modern_Interiors_Free_v2.2/Modern tiles_Free/`

**Furniture** — `Interiors_free/{16x16,32x32,48x48}/`, each holding
`Interiors_free_<size>.png` and `Room_Builder_free_<size>.png`.
The 16x16 interiors sheet is **256x1424** = 16 cols x 89 rows of 16px tiles.
Use the 16x16 set: the world tile size is 40px and existing packs are 16px art
scaled 2.5x, so matching that keeps everything consistent.

`Room_Builder_free_*` is the walls/floors/windows kit; `Interiors_free_*` is the
furniture. Both are needed for a believable room.

**Characters** — `Characters_free/`, five bases: **Adam, Alex, Amelia, Bob**
(plus an `RPGMAKERMV` export, ignore). Measured sheet sizes:

| sheet | size | note |
|---|---|---|
| `Adam_16x16.png` | 384x224 | full sheet, all poses |
| `Adam_idle_16x16.png` | 64x32 | |
| `Adam_idle_anim_16x16.png` | 384x32 | idle animation strip |
| `Adam_run_16x16.png` | 384x32 | run cycle |
| `Adam_sit_16x16.png` | 384x32 | **sit** — also `_sit2_`, `_sit3_` |
| `Adam_phone_16x16.png` | 144x32 | |

Frames are **16 wide x 32 tall**, so a 384x32 strip is **24 frames**. Confirm
that against the file before relying on it — measure, don't assume.

**This is why Tasks 2 and 3 are in one handoff:** the pack ships dedicated `sit`
sheets, so the sit mechanic and the animation variety come from the same source
and the same loader.

# TASK 1 — Reskin the UI with the fantasy border pack

The HUD, modals and buttons use flat Tailwind borders and colours today.
`NamedNpcModal.jsx` and its siblings are the place to start.

Reference the human gave: an ornate quest-dialog panel with corner-carved
borders, an "Accept quest" button, inventory slots with counts, a "Location
discovered" banner with sword-flourish dividers, and a Continue/New game/Options
menu list.

Scope guidance:
- Build **one** reusable panel component first and get it approved before
  rolling it out. 32 variants is a trap — pick a small consistent set (one panel,
  one border, one divider) and use them everywhere.
- The game is satirical finance, not high fantasy. Say so if the ornate frames
  fight the tone, and propose the subset that works rather than applying all of it.

# TASK 2 — Furniture and a sit mechanic

1. **Furniture in interiors.** Replace the bare desk rect with
   category-appropriate furnishings from `Interiors_free_16x16.png` — beds and
   kitchens in homes, machinery in industrial buildings, desks and seating in
   offices. Furniture must be **solid** (see the interior collision requirement
   in the verification bar).
2. **Sit mechanic.** A character on a chair/sofa tile swaps to the `sit` sheet.
   Decide and state whether this applies to the player, NPCs, or both — the
   human asked for "a sit mechanic" without specifying, and it changes the scope
   materially. Ask if unsure.

# TASK 3 — Character animation variety

NPCs are static frames. The pack provides idle-anim, run, sit and phone strips
for four distinct characters.

- Wire real animation states rather than one shared pose.
- Vary which base character an NPC uses **deterministically** by character id, so
  a given NPC always looks the same. Use `>>> 0` when hashing ids — a signed
  `>>` gives a negative index for about half of all ids, a bug this project has
  hit more than once.
- The existing player sprite is procedural (`playerSpriteArt.js` /
  `spriteGen.js`, 44x80 frames at 0.8 scale = ~35x64px on screen). **The pack's
  characters are 16x32 art.** At 2.5x that is 40x80px — close to the player, so
  they should sit together well, but verify rather than trusting the arithmetic.

# KNOWN CONSTRAINT — cross-pack scale

An unresolved issue you may inherit: inside the chapel, the player (~64px tall)
stands next to that pack's congregation (80px parishioners, a 120px priest).
Nobody has decided whether to scale the player up in that zone or accept the
difference. If Task 3 touches character scaling generally, raise it — don't
silently pick one.

# VERIFICATION BAR

**A harness already exists — use it, do not rebuild it.**

`production/probeGame.mjs` boots the real game in headless Chromium, clicks
through the menu to the overworld, screenshots the canvas, and samples frame
rate. This is the tool that was missing when three terrain optimisations shipped
broken.

```
npx vite preview --port 4173
node production/probeGame.mjs out.png [waitMs]
```

`production/checkMapLayout.mjs` asserts the map invariants (no building overlaps,
nothing on a street, road network connected) without a canvas. It bundles the
scene with rolldown and stubs `phaser`/the store — **read it before writing any
new Node-side check**, because the extensionless-import and Phaser-stub problem
is already solved there.

**Before you report success, personally confirm:**

1. `npm run build` passes.
2. `npm run lint` still at **37** warnings, 0 errors.
3. `node production/checkMapLayout.mjs` still PASSes.
4. **You have LOOKED at a screenshot** from `probeGame.mjs` showing your change,
   and you say what you saw. For UI work this is the only meaningful proof.
5. **Frame rate did not regress.** Sample it before and after. Be aware the
   headless reading is noisy — it varied 13-48 fps across runs on an unchanged
   build this session — so treat a single number as weak and say so rather than
   quoting the flattering one.
6. **Interior collision:** the player cannot walk through furniture, cannot leave
   the room, and cannot get stuck. Assert reachability from interior spawn to
   exit for every generated interior.
7. **Entry/exit contract intact:** entering and leaving every building type
   returns the player to the correct outdoor tile, and the
   `{type:'building', id, npcId}` payload still opens `NamedNpcModal`.

**On screenshots:** a still frame proves position and appearance. It does **not**
prove motion. Task 3 is animation — a screenshot cannot confirm it plays. If you
cannot verify movement, say exactly that rather than implying you did.

# REPORTING

Report: what was built, files changed, before/after numbers with real
measurements, what you rejected from supervisors/workers and why, and remaining
risks stated honestly. **Do not commit or push.**

If you hit a genuine blocking design decision this prompt doesn't settle — most
likely whether the ornate UI suits the game's tone, or whether sitting applies to
the player as well as NPCs — **stop and ask** rather than guessing.

Begin by forming a concrete plan and telling me the workstream split before you
spawn anyone.
