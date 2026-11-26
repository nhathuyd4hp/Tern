# Co-related features & parity reviewer

**Scope:** `packages/**`.

Adopt the reviewer persona and return findings in the output contract defined in
`_contract.md`.

Review the diff against **`.claude/rules/feature-parity.md`** (read it). This lens asks one
question of every changed file: **what else had to change with it, and did it?** For each changed
file, find it in the rule's tables, open the counterpart, and check whether the counterpart logic
is in the diff. Report with `file:line`, severity:

- **blocker** — a scripting API added or changed in `js/src/{bru,bruno-request,bruno-response}.js`
  without the matching bridge in `js/src/sandbox/quickjs/shims/`.
- **blocker** — a persisted field that skips a §1 layer: missing from `schema` (throws on
  save), the app save transform, one on-disk format, the BRU → YML migration, or OpenCollection
  import/export (either direction). Flag the missing surface only — the on-disk contract itself
  (compat, escaping, round-trip) belongs to the `dsl-changes` lens; don't duplicate its findings.
- **suggestion** — identical logic patched in both runtimes that has no Electron-only
  dependency and could move into `@usebruno/requests` / `@usebruno/common` (`utils/cookies.js` is
  the precedent); otherwise, a missing comment naming the pairing at both sites.
- **suggestion** — a feature at one scope level
  with no decision for the others or `inherit`; a wire-request change without a
  `snippet-generator.js` update; an HTTP-only change on a path gRPC/WebSocket also flow through;
  a Postman/Insomnia/OpenAPI converter not updated for a field its format can represent.
- **suggestion** — tests on one side of a pair only.

**Not a finding:** a stated asymmetry, or one the rule lists as known-divergent (no preferences
store / Electron window / system-browser OAuth / Yup validation in the CLI; CLI runner handles
only `http-request` and `graphql-request`). A change to runtime-specific code in a paired file
(e.g. an Electron-only helper in `utils/filesystem.js`) is not a gap. Never claim a missing twin
without confirming the twin file exists and holds the counterpart logic.
