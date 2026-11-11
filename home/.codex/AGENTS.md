<!-- context7 -->

Use Context7 MCP to fetch current documentation when a task depends on details of a library, framework, SDK, API, CLI tool, or cloud service that are version-sensitive or unfamiliar: recent or fast-moving releases, version migration, configuration and setup, library-specific debugging, or an API you are not sure about. Skip it for stable, well-known APIs you can answer confidently -- the free tier is limited, so do not spend calls confirming what you already know. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

If Context7 is rate-limited or does not have the library, or the question is how a public GitHub repository works internally, use the DeepWiki MCP instead.

## Steps

1. Always start with `resolve-library-id` using the library name and the user's question, unless the user provides an exact library ID in `/org/project` format
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question). Use version-specific IDs when the user mentions a version
3. `query-docs` with the selected library ID and the user's full question (not single words)
4. Answer using the fetched docs

<!-- context7 -->
