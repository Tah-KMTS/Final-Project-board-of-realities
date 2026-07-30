# Build Order: what we are actually building, in what order

**Written after** the relationship/conversation design and its four addenda.
**Supersedes** the ordering given inside `handoff-interiors.md`,
`handoff-ui-furniture-anim.md` and `design-relationships-and-talk.md` - each was
written without knowledge of the others, and they now conflict.

## The one-line summary

We are building a **social simulation**: a world where ~88 named characters move
continuously, occupy real interiors doing real activities, remember what you did
to them, and act on it. Not a romance feature.

---

# The dependency that reorders everything

`design-relationships-and-talk.md` addendum 3 sets a hard invariant: **NPCs never
teleport**. Everything visible depends on it, and neither handoff accounts for it:

- `handoff-interiors.md` puts characters inside buildings - but if they teleport
  in, being inside reads as a bug.
- The behaviour layer (storm off, follow) is position change - meaningless on top
  of dishonest motion.
- Occupied interiors need travel time, or a house fills with people who should
  still be commuting.

**So navigation comes first.** Building it later means rewriting whatever sits on
top of it.

---

# PHASE 1 - Movement honesty (foundation)

Nothing else should start before this lands.

1. **Navigation graph** from existing map data - nodes at doors, junctions,
   kerbs; edges with length and traversal mode. Generalise
   `roadRouteWaypoints()` / `pointAlongRoute()` from this session's NPC driving
   work; that is a working prototype of exactly this.
2. **Journeys in presence.** `resolvePresence()` stops being "where are they"
   and becomes "travelling to X, fraction f". The schedule yields to travel: a
   late NPC is late, not relocated.
3. **Continuous off-screen positions** + journey restore across zone loads.
4. **Retire push-out.** Keep `resolveOpenPosition()` as a safety net only, and
   count its firings - each one is an invariant violation.

**Fixes for free:** the straight-line-lerp-clipping-buildings bug (~12.4% of
travel frames) listed in `handoff-interiors.md`. Do not fix it separately.

**Verification:** continuity assertion - sample every agent per tick, flag any
jump beyond their speed. Must be zero. Genuinely falsifiable.

---

# PHASE 2 - Interiors and occupancy

Owned by `handoff-interiors.md`. Can start once Phase 1's journey model exists
(these need travel time, not the whole graph).

5. **Real interiors for 129 buildings** - category-appropriate rooms, furniture,
   staff. Replaces the identical 12x9 checkerboard.
6. **Characters actually inside them** - that handoff's Task 1.
7. **Furniture affordances** (`bed`, `chair`, `desk`, `kitchen`, `machinery`),
   from `handoff-ui-furniture-anim.md` Task 2. **Must be built as part of
   interior generation, not bolted on after** - the two handoffs collide here,
   and interiors wins.
8. **Occupied interiors** - `action` -> affordance -> position + animation
   (addendum 4). The activity strings already exist and are already displayed on
   screen; this is mostly wiring.

---

# PHASE 3 - Presentation

9. **Character animation** (`handoff-ui-furniture-anim.md` Task 3). Needed
   before Phase 4: a traversal or activity without an animation is disabled by
   rule, so animation gates content.
10. **UI reskin** (Task 1 of that handoff). Genuinely independent - can be done
    by someone else at any time, including now.

---

# PHASE 4 - The social layer

Only now does the relationship work make sense.

11. **Relationship state** - affection / trust / tension, stages, per-character
    `courtshipProfile` derived from traits and tier. Pure data.
12. **Conversation** - decision engine first, then utterance assembly. Do not
    tune prose against a broken decision model.
13. **Grievance ledger + emotion state.**
14. **Capability profiles** - what each character can actually do to you.
15. **Social graph + information propagation.**
16. **Behaviour layer** - storm off, follow, shadow. Path requests, now that
    paths exist.
17. **Intents** - grievance becomes a plan that advances and leaks.

Order within Phase 4 matters: **do not build intents before the social graph**,
or attacks feel motiveless.

---

# PROBLEMS - honest list

## 1. The teammate handoff is already out, and is now stale on ordering

`handoff-interiors.md` was written and sent before addendum 3 existed. It tells
an agent to put characters inside buildings with no navigation layer, and to fix
the straight-line clipping bug separately. **Both instructions are now wrong.**
If someone is already working from it, they need telling.

## 2. Two handoffs collide on interiors

`handoff-ui-furniture-anim.md` Task 2 adds furniture to interiors;
`handoff-interiors.md` Task 2 rewrites interiors wholesale. Sequenced wrong, the
furniture work is thrown away. The newer handoff flags it, but it needs a
decision, not a note.

## 3. Scope is much larger than it looks

This is a light social simulation. Phase 1 alone is substantial engineering -
pathfinding, journey state, save migration. Phase 4 is bigger than everything
shipped this entire session. It should not be estimated as "add romance to the
NPCs".

## 4. Performance is a real risk, not a theoretical one

The overworld sits around 45fps *today*, after this session's terrain work took
it from 20. Phase 1 adds continuous simulation for 88 agents plus pathfinding;
Phase 2 adds populated interiors; Phase 4 adds per-tick emotional state.

Mitigations exist - coarse graph rather than per-tile A*, path once per journey,
simulate positions but render only visible sprites - but **profile at the end of
each phase**, not at the end of the project. `production/probeGame.mjs` samples
frame rate.

## 5. Save migration, three separate times

`relationships[npcId]` is currently a number and real saves contain it. Phase 1
adds in-progress journeys; Phase 4 replaces that number with an object and adds
ledgers. Version the store and write migrations, or players lose saves.

## 6. Verification cannot be screenshots

Proven repeatedly this session: cars drove through buildings, through each
other, and teleported back to the pickup - every one survived review because **a
still frame cannot show motion**. Phases 1, 2 and 4 are all motion and
behaviour. Budget for watching it run, and write the headless assertions.

## 7. The fabricated-data problem is unresolved

`orientation` and `fidelity` are invented for all 88 characters (see
`character-data-provenance.md`), and Phase 4 makes them load-bearing. They must
be difficulty modifiers, never gates. Re-read that doc before starting Phase 4.

---

# What I would do next

**Start Phase 1.** It unblocks everything, fixes a known bug for free, and is the
only item here that gets harder the longer it waits.

**In parallel:** the UI reskin (item 10) - it touches nothing else, so it can run
independently today.

**Pause** interiors work until Phase 1's journey model is agreed, or it gets
rebuilt.
