# Design: Dynamic Relationships + Conversation Without an API

**Status:** design, not built. Written against the code as of `4e832c9`.
**Replaces:** `src/features/agents/romanceEngine.js` (72 lines, see gap analysis).

Two systems, deliberately separate but sharing one state store:

1. **Relationships** — dating, cheating, marriage, breakup. A real arc, not a
   0-100 bar.
2. **Conversation** — ask for things, get refused, feel talked-to. No API call.

## The decision the human made

Romance is available for **every** character. Difficulty varies by who they are;
nobody is hard-blocked. This is a change from the current engine, which refuses
outright on orientation and on `fidelity === 'Strictly Faithful'`.

That matters for `orientation`, which is **fabricated for all 88 characters** —
see `character-data-provenance.md`. It is the schema default applied uniformly
and was never researched. So it must stop being a **gate** and become at most a
**difficulty modifier**, because a hard block built on an invented value is both
wrong and unfair to the player. Same for `fidelity`.

## What exists today, and why it isn't enough

`romanceEngine.js`:
- one integer 0-100 per NPC (`relationships[npcId]`)
- hard refusal on orientation mismatch, hard refusal on faithful-and-married
- `+10/+15/+25/+35` per action, spouse at 100, and that's the end state
- no breakup, no cheating, no jealousy, no decay, no memory

So a relationship is a number that only goes up, and every character responds
identically to the same action. Both need to go.

## Part 1 — Relationship model

### State per character (replaces the single integer)

```js
{
  affection:   0..100,   // how much they like you
  trust:       0..100,   // separate axis - you can be liked and not trusted
  tension:     0..100,   // resentment, suspicion, recent friction
  stage:       'stranger' | 'acquaintance' | 'flirting' | 'dating'
             | 'committed' | 'married' | 'estranged' | 'ex',
  exclusive:   boolean,
  knownAffairs: string[], // npcIds they know you cheated with
  lastSeenDay: number,
  history:     Event[],   // capped; drives "remember when you..."
}
```

**Two axes, not one.** Affection and trust moving independently is what makes
the arc feel real: you can charm someone into dating who still won't lend you
money, and you can have a trusted business ally with no romantic interest.
Tension is what makes breakups possible without a scripted trigger.

### Difficulty per character — derive, don't hand-author

88 characters is too many to tune by hand, and hand-tuning drifts. Derive from
data already in the repo:

| Input | Source | Effect |
|---|---|---|
| disposition tier | `characterDispositions.js` | recluse = slow affection; socialite = fast |
| traits | `syndicate.js` `traits[]` | `Ruthless`/`Cold-Blooded` raise the trust cost; `Charismatic`/`Publicity-Seeker` lower the affection cost |
| `fidelity` | biographies | gates *cheating difficulty*, not access |
| `maritalStatus` | biographies | married = starts with an exclusivity penalty, not a refusal |
| net worth / role gap | roster | large status gap = slower start |

Produce a per-character `courtshipProfile { affectionRate, trustRate, jealousy,
forgiveness, cheatRisk }`, computed once and cached — the same pattern
`getDisposition()` already uses. **Deterministic from id**, so a character
always behaves consistently. Use `>>> 0` when hashing ids.

### The arc

- **Advance** through stages when affection *and* trust both clear a threshold —
  requiring both is what stops flowers-spamming from producing a spouse.
- **Cheating**: dating someone while `exclusive` risks discovery. Discovery
  chance rises with the other party's disposition tier (socialites see things),
  shared districts, and how public the date venue is. On discovery: tension
  spikes, trust collapses, `knownAffairs` records it, and their `jealousy`
  decides between estrangement and a second chance.
- **Breakup** is a *consequence*, not a menu item: sustained high tension, or a
  trust collapse, moves the stage to `estranged` then `ex`. Reconciliation is
  possible but the history persists and later attempts cost more.
- **Decay**: affection drifts down with `lastSeenDay` distance, faster for
  `socialite`, slower for `homebody`. This is what makes maintaining several
  relationships genuinely hard rather than just tedious.

## Part 2 — Conversation without an API

The requirement: it must feel like talking to a person, they can refuse, and it
must not be a fixed script.

**The key idea: separate the DECISION from the WORDING.** Canned dialogue feels
dead because both are fixed. If the decision is computed from live state and the
wording is assembled per-utterance, the exchange is genuinely dynamic without a
model.

### Layer A — the decision engine (this is where "dynamic" lives)

```
decide(character, request, worldState) -> {
  verdict: 'accept' | 'refuse' | 'negotiate' | 'deflect',
  reasonCode: 'too_soon' | 'costs_too_much' | 'distrusts_you'
            | 'wants_something_back' | 'wrong_place' | 'still_angry'
            | 'happy_to' | 'flattered' | 'suspicious_of_motive',
  counterOffer?: { wants, gives },
  deltas: { affection, trust, tension },
}
```

Inputs: the relationship state above, `courtshipProfile`, their mood (derivable
from the existing presence/schedule system — asking a favour of someone at work,
at 3am, or while they're hiding from a warrant should differ), request cost vs.
their resources, your reputation and wanted level, recent history with them, and
whether anyone else is present.

Nothing here is scripted. The **same request to the same person on two different
days can get different answers**, which is the whole point.

### Layer B — utterance assembly (this is where "not canned" lives)

Each character gets a **voice profile**, again derived not authored:

```js
{ register: 'formal'|'plain'|'crude'|'clipped'|'grandiose',
  warmth: 0..1, verbosity: 0..1, tics: ['...'] }
```

Derive from era, role and traits: a 15th-century emperor, a Prohibition
racketeer and a modern Fed chair should not share a sentence shape.

Build the line from **slots**, not sentences:

```
[opener?] [acknowledgement of what you asked] [verdict clause]
[reason clause, from reasonCode] [callback to history?] [tic?]
```

Each slot has several variants per register, chosen by a seeded RNG. Seed on
`(npcId, day, requestType, attemptIndex)` — so it is reproducible for testing
and for save-game consistency, but varies across time and context.

**The callback slot is what sells it.** Pulling one concrete item from `history`
— "after what happened at the Kyoto place, no" — costs almost nothing and reads
as memory, which is most of what people mean by "felt like a real conversation."

### Why this beats both alternatives

- vs. **fixed dialogue trees**: the decision is computed, so it isn't
  pre-determined, and the same node yields different outcomes by state.
- vs. **API calls**: no latency, no cost, no key, works offline, and it is
  *deterministic given a seed* — which matters enormously for save/load and for
  testing. It will never produce a genuinely novel sentence, but it will produce
  a contextually correct one, and players read correctness as intelligence far
  more than they read novelty.

**Honest limitation:** this will not hold up to freeform typed input. It answers
*structured* requests (ask for a favour, invite somewhere, flirt, confront,
apologise) very well. If freeform text input is wanted later, the API path
returns — but the decision engine above is still the right substrate for it,
with the model only rendering the wording.

## Build order

1. **Relationship state + `courtshipProfile` derivation.** Pure data, testable
   headless, no UI. Migrate `relationships[npcId]` integers into `{affection,
   trust, ...}` behind a version bump in the store.
2. **Decision engine.** Also pure. Unit-test verdict distributions across many
   characters and states — assert that a recluse and a socialite genuinely
   differ, which is the thing that will silently break.
3. **Utterance assembly.** Only once decisions are right, or you will be tuning
   prose against a broken model.
4. **Stage transitions, cheating, breakup.**
5. **UI.**

Steps 1-3 are all verifiable with plain Node — see `production/checkMapLayout.mjs`
for the rolldown + stub pattern that lets you import repo modules headlessly.

## Traps

- **Don't gate on `orientation` or `fidelity`.** They are fabricated for all 88
  characters. Difficulty modifiers only.
- **Don't let affection alone advance the stage.** Requiring trust too is what
  makes the system resistant to grinding.
- **Seed all randomness deterministically.** Use `>>> 0` on id hashes — a signed
  shift gives negative indices for about half of all ids, a bug this project has
  hit repeatedly.
- **Cap `history`.** It is per-character and persisted; unbounded growth will
  bloat every save.
- **Migrate the existing save shape.** `relationships[npcId]` is currently a
  number and real saves contain it.

---

# ADDENDUM - Grievance, betrayal and NPC agency

The model above is incomplete, and the gap is structural rather than a few
missing features. Recording it plainly so it is not rediscovered late.

**What is missing:** everything above models *relationship quality* - how much
someone likes and trusts you. It does not model **grievance** or **agency**.

- `tension` is a scalar mood. A grudge is *about something specific*, attributed
  to a person, and it can outlive the feeling that caused it. You can be calm
  and still be owed.
- Every NPC above is purely **reactive**. They answer requests. They never
  decide, on their own initiative, to do something to you. Betrayal, revenge and
  escalation are all NPC-initiated, so none of them are expressible.

Five additions close it.

## 1. Grievance ledger (replaces scalar tension as the memory of harm)

```js
grievances: [{
  id, what,            // stole_from, exposed, cheated_with, killed_ally,
                       // broke_promise, humiliated_publicly, refused_when_owed
  severity: 0..100,
  day, witnessed: boolean, publiclyKnown: boolean,
  target,              // usually the player, but NPC-vs-NPC too
  settled: boolean,    // paid off, avenged, or forgiven
}]
```

Grievances **compound rather than average** - three small slights from the same
person read as a pattern, which is how people actually work. Decay is per-trait:
Unforgiving / Cold-Blooded barely decay; `forgiveness` from the courtship
profile drives the rest. A public grievance decays slower than a private one,
because it costs them standing to let it go.

Keep `tension` as the short-term mood. The ledger is the long memory.

## 2. Emotion state, separate from relationship

Short-lived, decays over days, modulates decisions without changing how much
they like you: anger, fear, shame, pride, gratitude, contempt.

This is what lets someone who likes you refuse you today because you humiliated
them in front of a rival this morning - and agree next week.

## 3. Capability profile - what they can actually DO to you

A grudge only becomes murder if the character both **would** and **can**. Al
Capone can order a hit. Janet Yellen cannot and would not - but she can end your
access to credit, which for this game should hurt comparably.

```js
capabilities: { violence, legal, financial, social, informational }  // each 0..1
```

Derived, not authored: role and category (syndicate boss vs. regulator vs.
titan), `traits[]`, net worth, and the agency they head. **This is what makes
revenge character-appropriate instead of everyone reaching for the same knife**,
and it is the single most important addition here.

## 4. Intent - grievance that becomes a plan

When grievance x capability x opportunity crosses a threshold, the NPC forms an
**intent** that plays out over days rather than firing instantly:

```js
intent: { kind, target, progress, deadline, visibility }
// kind: sabotage | expose | ruin_financially | inform_authorities
//     | steal_from | blackmail | order_hit | freeze_out
```

Intents advance daily, and **leak**. Visibility means the player gets warning
signs - an ally mentions someone has been asking about you, a contact goes cold,
you notice you are being followed. That gives counterplay: settle the grievance,
buy them off, strike first, or leave town.

Without the delay and the leak this is just a random punishment. With them it is
a story.

## 5. Social graph - NPC-to-NPC, not just player-to-NPC

Betrayal needs stakes and revenge needs allies. Minimum viable version:

- pairwise affinity between NPCs, seeded from shared category, district,
  syndicate and era;
- **information propagation** - who tells whom. Your affair, your theft, your
  broken promise spreads along the graph at a rate set by the teller's
  disposition tier. Socialites leak; recluses do not;
- grievances against *their* allies become grievances against you, at reduced
  severity. Kill Nitti and Capone has a problem with you.

This is also what makes cheating dangerous in a way a per-character flag never
can: discovery is not a dice roll against the person you wronged, it is a
question of who saw and who talks.

## Betrayal, specifically

Betrayal is not a new system - it falls out of the above once NPCs have goals:

- **NPC betrays player**: they hold an obligation to you *and* a competing
  interest (a rival's offer, a threat, their own survival). Defecting is an
  intent with a payoff. High trust makes it *more damaging*, not less likely -
  the ones who can betray you are the ones you let close.
- **Player betrays NPC**: creates a grievance weighted by prior trust. Betraying
  someone who trusted you at 90 should be far worse than the same act against
  someone at 20. **Severity scales with the trust that was breached**, which is
  what makes the trust axis load-bearing rather than decorative.

## Consequence: the player needs exposure

For any of this to have weight, NPC action has to be able to *reach* the player
- assets that can be stolen or frozen, a reputation that can be damaged,
businesses that can be sabotaged, a wanted level informers can raise, and
physical vulnerability. Most of these exist already; they need to become
**targets** rather than only player-facing stats.

## Revised build order

Steps 1-3 from the original order still hold, then:

4. Grievance ledger + emotion state (extends relationship state; still pure data)
5. Capability profiles (derived, cached, same pattern as `getDisposition`)
6. Social graph + information propagation
7. Intent system + the daily tick that advances and leaks it
8. Stage transitions, cheating, breakup - much richer once 4-7 exist
9. UI

**Do not build the intent system before the social graph.** An NPC deciding to
ruin you with no model of who they know, who told them, or who backs them will
produce motiveless-feeling attacks, which is worse than no system at all.

## Honest scoping note

This is a substantially larger build than the original design - closer to a
light social-simulation layer than to a romance mechanic. It is buildable
incrementally: steps 4-5 alone make refusals feel motivated, and 6-7 are what
produce the emergent stories. But it should not be estimated as an extension of
the existing 72-line `romanceEngine.js`.

---

# ADDENDUM 2 - Behaviour: emotion the player can SEE

Everything so far changes what an NPC *says* and what they *plan*. None of it
changes where they stand. Emotion that only alters dialogue is not really felt.
A lover who trails you through three districts communicates more than any line.

So: a third layer, **Behaviour**, between emotional state and movement.

## Where this hooks in (already proven)

Named roamers move by lerping between two building doors:

```js
const t = presenceStepProgress(this.agentClock, roamer.phaseOffset)
rawPos = { x: doorA.x + (doorB.x - doorA.x) * t, ... }
```

`rawPos` then goes through `resolveOpenPosition()` and is applied. **That is the
hook.** This session's NPC-driving work already overrides `rawPos` for car
owners, re-splitting the journey into walk/drive/walk, and it works. A behaviour
is the same override with a different target.

Scoping consequence: **no new movement system is needed.**

## The behaviour set

Each has an owner, a target, a duration and an exit condition.

| Behaviour | Triggered by | What the player sees |
|---|---|---|
| `storm_off` | anger spike, insult, refusal-while-owed | Ends the conversation, walks briskly away, will not re-engage for N hours |
| `cold_shoulder` | grievance, moderate tension | Stays put, refuses interaction, turns away |
| `follow` | high affection, clingy traits | Tails you at a distance, closes when you stop |
| `shadow` | very high affection + low trust + jealousy | Follows further back, breaks off when you look, reappears. Unsettling by design |
| `avoid` | fear, shame, unpayable debt | Routes around you; leaves a building you enter |
| `flee` | fear spike, you are armed or wanted | Abandons schedule, heads home or to a crowd |
| `seek_out` | grievance ready to confront, or good news | Leaves their schedule to find you |
| `wait_for` | arranged meeting, or lying in wait | Loiters at a place until you arrive or it times out |
| `tail_target` | an intent against another NPC | Follows someone who is not you |

`tail_target` is what stops the world being player-centric: seeing Nitti shadow
Ricca across town tells a story nobody narrated.

## Tendency, not uniformity - the whole point

The same anger must not produce the same act in everyone. Derive a
`behaviourProfile`, cached like `getDisposition()`:

```js
{ volatility,   // anger -> storm_off vs. cold_shoulder
  clinginess,   // affection -> follow vs. give space
  possessive,   // jealousy -> shadow vs. withdraw
  boldness,     // grievance -> seek_out vs. avoid
  composure }   // how much emotion it takes to break schedule at all
```

Sources already in the repo: `traits[]` (`Ruthless`, `Charismatic`,
`Publicity-Seeker`, `Methodical`, `Cold-Blooded`), disposition tier, `fidelity`,
role. A `Methodical` capo with high composure does not storm off - he goes quiet
and forms an intent, which is more menacing. A `Publicity-Seeker` makes a scene.

**Two characters at identical anger must behave visibly differently.** That is
the acceptance test for this layer, and the thing that silently fails if
profiles are not really wired in.

## Rules that keep it from becoming noise

- **Composure gate.** Breaking schedule is exceptional. Most emotion should show
  as a changed line or a refusal. If half the roster is following the player the
  signal is worthless.
- **One behaviour at a time.** Priority: `flee` > `storm_off` > `seek_out` >
  `shadow` > `follow` > `avoid` > schedule.
- **Every behaviour has an exit** - duration, satisfaction, or distance cap. A
  follower must eventually give up or the player can never shake them.
- **Behaviours resume the schedule, not replace it.** On exit the NPC returns to
  where presence says they are, so `NamedNpcModal` location text stays honest.
- **Respect the movement rules already built.** Followers walk; a car-owning NPC
  in `seek_out` uses the driving route. Do not bypass `resolveOpenPosition`
  except where the car path already does.

## Interaction with intents

Behaviours are short-term and visible; intents are long-term and hidden.

- An intent in progress emits supporting behaviours - `tail_target`, `wait_for`,
  `seek_out`. That IS the leak addendum 1 calls for: the warning is not a popup,
  it is seeing them outside your building.
- A behaviour can create an intent: storming off in public costs them standing,
  which becomes a grievance of its own.

## Build order

Slot after step 5 (capability profiles), before intents:

- **5b.** `behaviourProfile` derivation. Pure, testable. Assert two characters at
  equal anger diverge.
- **5c.** Behaviour state machine + `rawPos` override, starting with only
  `storm_off` and `follow`. Those two alone change how the game feels.
- **5d.** The rest, then wire intents to emit supporting behaviours.

## The honest risk

This is the layer most likely to feel broken rather than alive, because it is
the most visible. A follower clipping through a wall, or an NPC who storms off
and teleports back to their schedule position, reads as a bug and destroys the
emotional effect.

The vehicle work this session is the cautionary tale: cars driving through
buildings, through each other, and teleporting back to the pickup all survived
review because **a screenshot cannot show motion**. Behaviours must be watched in
a running game. See `production/probeGame.mjs`.
