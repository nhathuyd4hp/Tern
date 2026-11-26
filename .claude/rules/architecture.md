---
paths:
  - "packages/**/*"
---

# Dependency Boundaries

Internal `@usebruno/*` dependencies (from each `package.json`) form a strict DAG. **New code must
respect it** — a cyclic or upward dependency is an architectural bug, not a convenience.

The full monorepo map (build tools, request pipeline, sandbox, file formats, core data-model
types, dependency versions) is the on-demand reference `.claude/reference/architecture.md` — read
it before non-trivial cross-package or architectural work.

## Dependency direction & ownership boundaries

- **Leaf libs — zero internal `@usebruno/*` deps:** common, lang, query,
  requests, graphql-docs, schema, schema-types, sqlite
  (a leaf, but *not* platform-neutral — see guardrail 6).
- **Mid consumers:** js → (common, query); converters → (common, schema; schema-types
  as devDep); filestore → (common, lang; schema-types as devDep).
- **Top consumers (things flow *into* them, never out):** electron → (common, converters, filestore, js, lang,
  requests, schema, sqlite); app → (common, converters, graphql-docs, schema).

Guardrails this enforces:

1. **common is the browser-safe base leaf.** It runs in the web renderer (`app`), not
   just Node, so it must stay platform-neutral: no Node built-ins (`fs`, `path`, `os`, `crypto`,
   `child_process`, `node:*`) and no dependency that itself pulls in Node. It currently ships with
   zero runtime dependencies — keep it that way. It also depends on no other `@usebruno/*` package;
   a util that needs Node or another bruno package belongs in a different package.
2. **No shared/library package may import app or electron.** Renderer- or
   Electron-specific code must not be pushed down into a lib to make it importable upward.
3. **js must stay Electron-free.** It is a plain Node library; keep it free of Electron/IPC
   imports so it stays reusable and testable outside the app. Sandbox logic
   belongs in js; host wiring belongs in electron.
4. **schema-types is types-only** (a *devDependency* of converters/filestore, built with
   plain `tsc`). Import types from it; never add runtime code or a runtime import of it.
5. **schema (Yup) and schema-types (TS types) are distinct and both live.** app +
   converters use `@usebruno/schema` for runtime validation; filestore + converters use
   `@usebruno/schema-types` for compile-time types. A data-model change usually touches both.
6. **sqlite is main-process only.** `@usebruno/sqlite` (= `/node`) imports `node:sqlite`,
   `node:fs` and `node:crypto`; importing it from the renderer breaks the bundle. The renderer
   reaches statements only through the per-statement IPC handlers in electron. See
   `.claude/rules/sqlite.md`.

## Declared dependencies must match real imports

A package's `package.json` is the contract; workspace hoisting hides breaches of it. Declare every
import in the manifest of the package that imports it — one resolving only because a sibling or the
root happens to pull it in is a latent break. Test- and build-only packages belong in
`devDependencies`; anything in `dependencies` ships to users with its transitive tree. Drop a
declaration when the change removes its last consumer.
