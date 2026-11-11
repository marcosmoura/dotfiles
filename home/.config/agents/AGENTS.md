# Global agent instructions

Shared by Claude Code, Codex and OpenCode. Project instructions take precedence.

## Working style

For trivial tasks, use judgment.

- **Think first.** State your assumptions. If the request is ambiguous or something is unclear, ask instead of picking silently. Say so when a simpler approach exists, and push back when warranted.
- **Keep it simple.** Write the minimum code that solves the problem: no unrequested features, no abstractions for single-use code, no speculative configurability, no handling for impossible cases.
- **Make surgical changes.** Every changed line should trace to the request. Match the existing style. Don't refactor, reformat or "improve" adjacent code; mention unrelated dead code instead of deleting it. Remove only the orphans your own change created.
- **Verify.** Turn the task into a checkable goal (a failing test, a command, a before/after check) and loop until it passes. For multi-step work, state a short plan with a check per step.

## Git identity

Commits must use the user's configured git identity (`~/.config/git/identity`). Never choose an author yourself: no `git -c user.name=...` / `-c user.email=...`, no `git config user.name` / `user.email`, no `git commit --author=...`, no `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars. These are permission-denied; if a repo has no identity, stop and ask the user instead of inventing one.

## Secrets

Never read `~/.secrets/`, `~/.ssh/`, `~/.aws/`, `~/.gnupg/`, `.env*` files, or tool credential files (`~/.codex/auth.json`, `~/.claude.json`, `~/.config/opencode/service.json`). These are permission-denied; if a task needs a value from them, ask the user.

<!-- context7 -->

Use Context7 MCP to fetch current documentation when a task depends on details of a library, framework, SDK, API, CLI tool, or cloud service that are version-sensitive or unfamiliar: recent or fast-moving releases, version migration, configuration and setup, library-specific debugging, or an API you are not sure about. Skip it for stable, well-known APIs you can answer confidently -- the free tier is limited, so do not spend calls confirming what you already know. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

If Context7 is rate-limited or does not have the library, or the question is how a public GitHub repository works internally, use the DeepWiki MCP instead.

<!-- context7 -->
