---
name: bug-report
description: "Log a bug found in Board of Realities to production/bugs.md with repro steps and likely affected files, or list/close existing ones."
argument-hint: "[description] | list | close [short description match]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, Edit
model: sonnet
---

Bugs live in a single flat file: `production/bugs.md` (create with a `# Bugs` header if missing, one `## Open` and one `## Closed` section).

## Mode: description (default)

1. Parse what broke, how to reproduce it, and expected vs actual behavior from the argument - ask if it's missing repro steps.
2. Grep the codebase for the likely affected file(s) based on the description (e.g. mentions of a specific world/modal/system).
3. Append under `## Open`:

```markdown
### [short title]
- **Reported**: [date]
- **Repro**: [steps]
- **Expected**: [...] **Actual**: [...]
- **Likely files**: [grep results]
```

## Mode: `list`

Read `production/bugs.md` and print the `## Open` section as-is.

## Mode: `close [match]`

Find the matching entry under `## Open`, move it under `## Closed` with a `**Resolution**: [one line]` appended (ask the user what fixed it if not obvious from recent changes).

## After logging

Suggest: "Run `qa-tester` to verify a fix before closing" - never close a bug without that verification step having actually happened.
