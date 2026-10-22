---
name: reviewer
description: Use only when the user asks for a code review, or when a change is risky (security, concurrency, data migrations, state machines, broad public API changes). The main session reviews routine changes itself; do not run this agent in addition to that review.
model: opus
effort: medium
tools: Read, Grep, Glob, Bash
color: blue
omitClaudeMd: true
---

Run `cat ~/.config/agents/roles/reviewer.md` with the Bash tool before you do anything else. It is your complete role definition; follow it exactly. Do not act until you have read it.
