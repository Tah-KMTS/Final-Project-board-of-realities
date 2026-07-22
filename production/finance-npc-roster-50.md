# Finance World — 50-character real-world NPC roster

Addendum to `finance-world-reference.md`. All entries are real, public, historical or currently-active figures, summarized from well-documented public reputation/philosophy - satirical-caricature tier, same treatment as the 4 existing bosses, not claims of authentic private thought/decisions. **4 remain fightable/robbable bosses** (already in game + Howard Marks, confirmed); **the other 46 are ambient named NPCs** with a short flavor-dialogue line each, scattered through the Financial District region.

## Bosses (4) — fightable/robbable, full boss treatment
1. **Warren Buffett** — value investing, "Oracle of Omaha." *(already in-game)*
2. **Cornelius Vanderbilt** — railroad/shipping tycoon, ruthless competitor. *(already in-game)*
3. **Elon Musk** — erratic mogul, meme-stock/crypto-adjacent persona. *(already in-game)*
4. **Howard Marks** — Oaktree co-founder, market-cycle philosophy, "you can't predict, but you can prepare." *(confirmed addition)*

## Ambient named NPCs (46) — ambient/flavor-dialogue tier

**Gilded Age industrialists**
5. John D. Rockefeller — Standard Oil, first great U.S. monopoly.
6. Andrew Carnegie — steel magnate, later history's largest philanthropist.
7. J.P. Morgan — banker who personally organized bailouts of failing industries.
8. J. Paul Getty — oil magnate, once the world's richest private citizen.
9. Henry Ford — assembly-line manufacturing, mass-production wealth.
10. Jay Gould — railroad speculator, notorious market manipulator of his era.

**Legendary investors**
11. Charlie Munger — Buffett's partner, blunt aphoristic wisdom.
12. George Soros — macro trader, "broke the Bank of England" 1992.
13. Ray Dalio — Bridgewater founder, "principles"-based risk parity.
14. Carl Icahn — activist investor/corporate raider archetype.
15. Peter Lynch — Fidelity Magellan, "invest in what you know."
16. Benjamin Graham — father of value investing, Buffett's mentor.
17. John Bogle — Vanguard founder, index-fund pioneer, low-cost investing advocate.
18. Seth Klarman — Baupost Group, deep-value/margin-of-safety investing.
19. Jim Simons — Renaissance Technologies, pioneered quantitative/algorithmic investing.
20. Paul Tudor Jones — macro trader, predicted the 1987 crash.
21. Stanley Druckenmiller — macro trader, worked alongside Soros on the pound trade.
22. Bill Gross — "Bond King," built PIMCO into a fixed-income giant.
23. David Tepper — Appaloosa Management, distressed-debt specialist.
24. Ken Griffin — Citadel founder, one of the largest hedge funds today.
25. Steve Cohen — Point72, high-volume trading style.

**Activist investors**
26. T. Boone Pickens — oil tycoon turned corporate raider.
27. Nelson Peltz — Trian Partners, board-seat activism.
28. Dan Loeb — Third Point, known for sharply worded public letters to targeted companies.

**Cautionary tales / infamous figures**
29. Bernie Madoff — largest Ponzi scheme in history.
30. Jordan Belfort — "Wolf of Wall Street," pump-and-dump stock fraud.
31. Michael Milken — 1980s junk-bond pioneer, convicted then a prominent philanthropist.
32. Ivan Boesky — 1980s insider-trading scandal, "greed is good" era icon.
33. Sam Bankman-Fried — FTX collapse, convicted of fraud.
34. Elizabeth Holmes — Theranos, convicted of investor fraud.

**Short sellers / contrarians**
35. Michael Burry — predicted/profited from the 2008 subprime collapse.
36. Bill Ackman — activist short/long investor, aggressive public campaigns.
37. Jim Chanos — famous for shorting Enron before its collapse.

**Central bankers / economists**
38. Alan Greenspan — long-serving Fed Chair, "irrational exuberance" era.
39. Ben Bernanke — Fed Chair during the 2008 crisis response.
40. Janet Yellen — Fed Chair, later Treasury Secretary.
41. Milton Friedman — free-market economist, monetarism.
42. John Maynard Keynes — foundational economist, government-intervention theory.

**Crypto era**
43. Changpeng Zhao — Binance founder.
44. Vitalik Buterin — Ethereum co-founder.
45. Satoshi Nakamoto — anonymous Bitcoin creator, identity unknown - good as a mysterious/masked NPC.
46. Brian Armstrong — Coinbase founder.

**Tech moguls tied to markets**
47. Jeff Bezos — Amazon founder.
48. Bill Gates — Microsoft founder, major philanthropic investor.
49. Mark Cuban — investor/entrepreneur, public "Shark Tank" persona.
50. Jamie Dimon — JPMorgan Chase CEO, prominent modern banking voice.

## Implementation note for the Finance content pass
- Reuse whatever ambient-NPC spawner pattern the region already has (per the project's own architecture notes, NPCs are placed via per-scene spawner functions using `characterPalettes.js` for appearance) - these are palette-only procedural sprites, no portraits needed.
- Each ambient NPC needs just one short line of flavor dialogue grounded in their real public reputation/philosophy (e.g. Bogle: "Costs matter. Fees are the silent killer of returns." / Boesky: "Somewhere, someone else's loss is your opportunity."). Keep to the writer persona's existing rule: short, in-register, no invented scandal beyond what's publicly documented.
- Don't build unique quests/mechanics for all 46 - that's boss-tier scope reserved for the 4 above. Ambient NPCs are for world density/texture (exactly the density Pokemon-style town NPCs provide), not new systems.
