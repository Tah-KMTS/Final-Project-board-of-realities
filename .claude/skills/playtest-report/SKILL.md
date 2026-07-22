---
name: playtest-report
description: "Captures a quick playtest note for Board of Realities - what worked, what confused, what broke - appended to production/playtests.md."
argument-hint: "[notes from the session, or 'new' for a blank template to fill in conversation]"
user-invocable: true
allowed-tools: Read, Write, Edit
model: sonnet
---

Playtest notes live in `production/playtests.md` (create with a `# Playtests` header if missing).

## Capture

Ask (briefly, plain conversation, not a form) if not already given:
- Which world/feature was being tested
- What worked, what confused or frustrated, anything that broke

Append:

```markdown
## [date] - [world/feature]
**Worked**: ...
**Confusing/frustrating**: ...
**Broke**: ...
**Next action**: [design change / bug / polish / nothing]
```

## Route the "next action"

- Design change → hand to `game-designer`
- Bug → run `/bug-report [description]`
- Polish → hand to `visual-polish` or file in `producer`'s backlog
- Balance → hand to `game-designer` with the specific numbers that felt off

Keep this fast - the point is capturing the note before it's forgotten, not producing a formal document.
