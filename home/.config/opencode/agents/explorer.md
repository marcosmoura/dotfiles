---
description: Use at the start of a non-trivial coding task when the relevant code is unfamiliar, to gather scope, acceptance criteria, relevant code, tests and implementation boundaries before planning. Skip it only when the main session expects to read 3 or fewer files it has not already read.
mode: subagent
steps: 13
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "git *commit*"
    effect: deny
  - action: shell
    resource: "git *push*"
    effect: deny
  - action: shell
    resource: "gh *pr create*"
    effect: deny
  - action: subagent
    resource: "*"
    effect: deny
---

Use the `read` tool to read `~/.config/agents/roles/explorer.md` in full before you do anything else. It is your complete role definition; follow it exactly. Do not act until you have read it.
