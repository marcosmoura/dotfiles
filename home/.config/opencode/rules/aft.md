# AFT navigation

- Use AFT only when its tools are available; fall back to native tools if indexes are unavailable.
- For known exact literals, use scoped `grep`; for unknown concepts, use a small scoped `aft_search` (`topK: 5`).
- For large files, use `aft_outline` and `aft_zoom`, then native `read` for source context as needed.
- Source-check relevant code before native edits; navigation results are not proof of correctness.
- Use `aft_inspect` for Code Health; diagnostics use the TypeScript, Rust and Swift language servers, while Swift dead-code analysis is unsupported. Callgraph queries remain disabled; use project builds and tests for correctness.
- Respect ignored files, scope searches narrowly, and avoid huge reports.
