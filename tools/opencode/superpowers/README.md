# OpenCode Superpowers

OpenCode v2 adapter for [Superpowers](https://github.com/obra/superpowers). It
registers upstream skills automatically and adds the `using-superpowers`
bootstrap to every agent request, including requests after compaction.

The adapter reads skills from the pinned `superpowers` dependency rather than
copying them. To update, change the dependency ref in `package.json`, run
`pnpm install`, `pnpm test`, and `pnpm typecheck`, then restart OpenCode.
