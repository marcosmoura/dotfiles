<!-- context7 -->

Use Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Always start with `resolve-library-id` using the library name and the user's question, unless the user provides an exact library ID in `/org/project` format
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question). Use version-specific IDs when the user mentions a version
3. `query-docs` with the selected library ID and the user's full question (not single words)
4. Answer using the fetched docs

<!-- context7 -->

## Shared orchestrator

Read `~/.config/agents/orchestrator.md` in full before your first action and follow it exactly. It defines delegation, scoping, shipping, review, and escalation.

## Codex delegation notes

- Spawn a role with `spawn_agent` and pass the role name in `agent_type`.
- For `scout` and `shipper`, set `fork_turns = "none"` to start them without parent history. The role's model applies regardless of inherited history; `fork_turns` only controls context.
- Continue an existing worker with `followup_task` so it keeps its context.
