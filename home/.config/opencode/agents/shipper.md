---
description: Commit, push and open or update a pull request after implementation and review are complete. Use only when the user has explicitly asked to commit, push, open a PR or ship the completed changes.
mode: subagent
steps: 11
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: subagent
    resource: "*"
    effect: deny
---

Use the `read` tool to read `~/.config/agents/roles/shipper.md` in full before you do anything else. It is your complete role definition; follow it exactly. Do not act until you have read it.
