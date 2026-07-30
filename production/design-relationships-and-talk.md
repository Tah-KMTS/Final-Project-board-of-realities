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
