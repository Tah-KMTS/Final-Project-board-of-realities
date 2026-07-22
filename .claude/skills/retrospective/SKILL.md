---
name: retrospective
description: "Quick look back at recent Board of Realities work (via git log) - what went well, what to change - appended to production/retros.md."
argument-hint: "[optional: date range or 'since last retro']"
user-invocable: true
allowed-tools: Read, Write, Edit, Bash
model: sonnet
---

Retros live in `production/retros.md` (create with a `# Retrospectives` header if missing).

## 1. Gather

Run `git log --oneline` since the last retro entry's date (or last ~10 commits if no prior retro). Summarize what actually shipped in plain language, grouped by world/system.

## 2. Ask

One or two open questions: "what felt slow or frustrating this stretch?" / "anything you'd do differently?" - conversational, not a checklist.

## 3. Append

```markdown
## [date]
**Shipped**: [summary from git log]
**Went well**: ...
**To change**: ...
**Action items**: [concrete, small - e.g. "check build before calling qa-tester" not "improve process"]
```

Keep action items concrete enough that they could be checked off, and few enough (1-3) that they'll actually get done.
