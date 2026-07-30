# Character Data: what is factual and what is fabricated

**Roster:** 88 characters. **Written:** after renaming the twelve fictionalised
public figures to their real names (commit `7896285`).

This exists because the roster now names **real people**, several of them
living, and the biography fields are about to drive an interaction/romance
system. Anyone extending that needs to know which values are sourced and which
were invented, because they are not distinguishable by looking at the data.

## The short version, by field

| Field | Status | Notes |
|---|---|---|
| `name` | **Factual** | All 88 name real people, except 2 (below). |
| `category` / `title` | **Factual** | Real roles: SEC Chair, Fed Chair, cartel boss, etc. |
| `age` | **Mostly factual** | Age at death for historical figures, current age for the living. Two deliberate exceptions below. |
| `gender` | **Factual** | 6 female, 82 male. Verified individually. |
| `maritalStatus` | **Mostly factual** | Documented for the well-known; assumed for minor figures. |
| `bio` | **Factual** | Summarises real careers. |
| `orientation` | **FABRICATED** | See below — this is the big one. |
| `fidelity` | **FABRICATED** | Not a factual field at all. |

## FABRICATED — `orientation`

**Every one of the 88 is set to `'Heterosexual'`, and that is an assumption,
not a finding.** For essentially nobody on this roster is sexual orientation
part of the documented public record. The value was never researched; it is the
schema's default, applied uniformly.

This matters more than it looks, because `romanceEngine.js` gates on it:

```js
if (playerGender === bio.gender && bio.orientation === 'Heterosexual') { ... }
```

So the romance system's entire same-sex/opposite-sex logic currently rests on a
field that carries no information. **Treat it as a game setting, not a claim
about a person.**

## FABRICATED — `fidelity`

Not a factual field even in principle. It feeds
`deriveSociabilityAndAffinity()` in `characterDispositions.js` and its values
are a mix of registers that were never about faithfulness:

- behavioural: `'Strictly Faithful'`, `'High Loyalty'`, `'High Romance Risk'`
- occupational: `'Dedicated Regulator'`, `'Open to Alliance'`

Only a handful correspond to public record — J.P. Morgan, Joseph P. Kennedy Sr.,
William O. Douglas (four marriages), Jeff Bezos and Bill Gates (both divorced
amid reported affairs). **For everyone else the value is invented.** Labelling a
real named person "High Romance Risk" with no evidence is an allegation, so
non-documented entries were left on neutral values rather than being filled in
with something more colourful.

## FABRICATED — two characters entirely

| Name | Role | Note |
|---|---|---|
| Osvaldo Trujillo | Crime Syndicate Underboss | No such Medellín figure. Invented. |
| Dixon Trujillo | Crime Syndicate Capo | Invented. |

Every other name on the roster is a real person.

## Deliberate non-facts (period choices, not errors)

- **Griselda Blanco, age 43.** She died at 69 (1943-2012). 43 places her in the
  peak Miami era the game depicts.
- **Historical figures shown alive together.** Mansa Musa, Hamilton, Rockefeller
  and Elon Musk share a map. The whole premise is anachronistic.

## Corrected while auditing (were wrong, now factual)

- **Madam C.J. Walker** — listed `'Married'`. She divorced Charles Joseph Walker
  in 1912 and died unmarried in 1919. Now `'Divorced'`.
- **Nine agency leaders** (Kennedy Sr., Douglas, Levitt, Mueller, Caplin,
  Andrews, McNamara, Marshall, Ruckelshaus) had **no entry at all** and hit a
  fallback hardcoding `gender: 'Male'`, `age: 45` and the bio *"Prominent figure
  in the Capital Syndicate."* — wrong for all nine, none of whom are syndicate.
  They now have real biographies.
- **Three stale ages** — Yellen 77→78, Ramirez 45→56, Majoras 56→61.

## The six female characters

| Name | Role | Marital status | Factual? |
|---|---|---|---|
| Madam C.J. Walker | Financial Titan | Divorced | Yes — divorced 1912, died unmarried 1919 |
| Griselda Blanco | Crime Syndicate Boss | Widowed | Yes — husbands Bravo and Sepúlveda both died violently |
| Janet Yellen | Fed Chair | Married | Yes — George Akerlof, since 1978 |
| Lina Khan | FTC Chair | Married | Yes — married 2020 |
| Edith Ramirez | FTC Chair | Married | Yes |
| Deborah Platt Majoras | FTC Chair | Married | Yes — John Majoras |

## Before building the romance system — read this

The roster now names **real, living people** (Buffett, Soros, Gates, Bezos, Musk,
Powell, Khan, Huang, Son, Icahn, Dalio, Mueller, Levitt). Satirising their public
conduct — markets, monopolies, regulation — is ordinary and fine.

A romance mechanic is a different thing. It attaches **invented sexual
orientation and fabricated fidelity** to named living individuals and invites the
player to pursue them. Two suggestions, neither of which blocks the feature:

1. **Scope romance to the deceased and the fictional.** Historical figures and
   the two invented Trujillos carry far less of this problem than living ones.
2. **If living figures stay in scope, keep it non-sexual** — alliances, favours,
   rivalry, patronage. The disposition system already models that well, and
   `fidelity` already reads as an alliance stat for the regulators.

Whichever way it goes, **do not present fabricated `orientation` or `fidelity`
in the UI as though it were biography.** The bios are real; those two fields are
not, and the interface currently shows them side by side.
