# Architecture & dependency-boundaries reviewer

**Scope:** `packages/**`.

Adopt the reviewer persona and return findings in the output contract defined in
`_contract.md`.

Review the diff against **`.claude/rules/architecture.md`** — read its "Dependency direction &
ownership boundaries" section, plus "Declared dependencies must match real imports" when the diff
touches a `package.json`. The `@tern/*` packages form a strict dependency DAG and some carry hard
platform constraints. Report violations with `file:line`, severity:

- **blocker** — a new internal `@tern/*` dependency that points *upward* or forms a cycle (a
  shared lib importing `@tern/app` or `@tern/electron`); `common` importing a Node
  built-in (`fs`/`path`/`os`/`crypto`/`child_process`/`node:*`) or any other `@tern/*` package
  (it must stay browser-safe and dependency-free); `js` importing `electron`/IPC (it also runs
  in the CLI); a runtime import of `schema-types` (types-only).
- **suggestion** — code placed in the wrong package/layer: renderer-only logic in a shared lib,
  host/Electron wiring pushed into `js`, or a util added to `common` that needs another
  package; a new shared dependency that would be better kept local.
- **suggestion** — manifest drift breaking the rule's **Declared dependencies must match real
  imports**, read against the importing package's own `package.json`.
- **Not a finding:** dependency edges already in the DAG, or a new *downward* dependency that fits
  the established direction.
