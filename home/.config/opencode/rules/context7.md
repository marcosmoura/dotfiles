---

alwaysApply: true

# Context7

For library/framework questions, use Context7 MCP instead of training data.

1. `resolve-library-id` with the library name and user's question
2. Pick the best match (prefer exact names, version-specific IDs when version is mentioned)
3. `query-docs` with selected library ID and user's question
4. Answer using fetched docs, include code examples, cite version
