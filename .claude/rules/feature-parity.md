---
paths:
  - "packages/**/*"
---

# Co-Related Features & Parity Surfaces

Bruno implements the same behaviour more than once — `.bru` vs `.yml`, filestore vs
converters, implementation vs QuickJS shim. **A change to one side of a pair is not a finished
change**: the other side silently keeps the old behaviour and ships. The symptom is never a broken
build — it's a field that survives save but
vanishes on export or migration, a `bru.*` method that is `undefined` in the default sandbox.

This rule maps *which* surfaces pair up. `.claude/rules/dsl-changes.md` owns the on-disk contract
in depth.

## When you work on a change

1. **Find the twin before writing the fix.** For every file you touch in the tables below, open
   its counterpart.
2. **Update the twin in the same change** when it's within what was asked.
3. **Otherwise, say so explicitly.** If the twin is out of scope, doesn't apply, or you're unsure,
   list it in your reply to the user (and in the PR description) with the path and why it was left
   — never leave a one-sided change unmentioned.
4. **Prefer unifying over copying.** If the logic has no Electron-only dependency, move it
   into `@usebruno/requests` / `@usebruno/common` (respecting `.claude/rules/architecture.md`)
   instead of patching twice. Where both copies must stay, note the
   pairing in a comment at both sites.

## 1. Persisted fields — every layer that carries a field list

A field is added in one place and read in many. Each of these keeps its **own** list, aligned by
hand:

| Layer | Where | Missed → |
|---|---|---|
| Types | `bruno-schema-types/src/collection/item.ts` | type drift |
| Yup schema | `bruno-schema/src/collections/index.js` — `.noUnknown(true)`, cast output is persisted | **silently stripped on save** |
| App save transform | `bruno-app/src/utils/collections/index.js` — `transformRequestToSaveToFilesystem`, `transform{Collection,Folder}RootToSave`, `transformCollectionToSaveToExportAsFile` | dropped before reaching disk / Bruno JSON export |
| On-disk formats | `bruno-filestore/src/formats/{bru,yml}` (+ `bruno-lang`) — parse **and** stringify | lost in one format |
| BRU → YML migration | `bruno-electron/src/ipc/yml-migration.js` (bru parse → yml stringify) | lost when a user migrates |
| Collection config | `bruno.json` ↔ `opencollection.yml` — `utils/transformBrunoConfig.js`, `stringifyCollection`, migration's config transform (e.g. `transformProxyConfig`) | config lost or misread |
| OpenCollection import/export | `bruno-converters/src/opencollection/items/{http,graphql,grpc,websocket}.ts`, `folder.ts`, `environment.ts` — **both** directions; app entry `bruno-app/src/utils/exporters/opencollection.js` | lost on export or import |
| Other converters | `postman/{postman-to-bruno,bruno-to-postman}.js`, `insomnia/`, `openapi/`, `wsdl/`; app exporters `postman-collection.js`, `openapi-spec.js`, `bruno-environment.js` | lost on import/export where the target can represent it |

The migration also rewrites content, not just shape: `bru.runRequest("x.bru")` paths are stripped
of `.bru`, and tab snapshots are remapped. A new script API that takes a file path, a new file
type, or a new `bruno.json` key needs a matching migration step.

## 2. Scripting API ↔ QuickJS shim

`bruno-js/src/{bru,bruno-request,bruno-response}.js` implement the API. The **QuickJS sandbox — the
default "safe" mode — bridges each method explicitly** in `bruno-js/src/sandbox/quickjs/shims/`
(`bru.js`, `bruno-request.js`, `bruno-response.js`, `bruno-grpc.js`, …). Implementation only →
works in developer mode, `undefined` for most users.

The JSDoc on these classes is the source of the published script API reference. A new or changed
member needs its JSDoc per `packages/bruno-js/readme.md` § "Script API JSDoc" — summary, typed
tags, `@category`; `@internal` for host-only state; `@runtime nodevm` if the shim deliberately
doesn't bridge it. Then run `npm run generate:script-api` and commit `types/script-api.d.ts`.

## 3. Scope levels — collection ↔ folder ↔ request

Auth, headers, vars, scripts and tests exist at three levels plus `inherit`. Each level has its own
UI (`CollectionSettings/`, `FolderSettings/`, `RequestPane/`), and resolution lives in the merge
helpers in **each** runtime's `utils/collection.js`. A feature at one level needs a stated decision
for the other two and for `inherit`.

## 4. Protocols — HTTP ↔ GraphQL ↔ gRPC ↔ WebSocket

`REQUEST_TYPES` (`bruno-app/src/utils/common/constants.js`, `bruno-electron/src/utils/constants.js`)
lists all four. Each has its own `parse*`/`stringify*` in `bruno-filestore/src/formats/yml/items/`
and its own converter in `bruno-converters/src/opencollection/items/`. "HTTP only" is a legitimate
scope — leaving it unstated is how a gap becomes a bug report.

## 5. Request shaping ↔ code generation

`GenerateCodeItem/utils/snippet-generator.js` consumes headers, body, `settings` and resolved auth.
A new auth mode or a setting that changes the wire request should change the generated snippet.

## Parity checklist

- [ ] Every twin in the tables opened; updated, or listed to the user with a reason
- [ ] Shared logic moved to a leaf package where the DAG allows, instead of patched twice
- [ ] Persisted field carried through every layer in §1 — including migration and converters (both directions)
- [ ] New/changed `bru.*`, `req.*`, `res.*` API bridged in the QuickJS shim
- [ ] Its JSDoc written and `types/script-api.d.ts` regenerated, with no generator warnings
- [ ] Collection / folder / request levels and `inherit` each decided
- [ ] gRPC and WebSocket considered; any "HTTP only" scope stated
- [ ] Code generation updated if the wire request changed
- [ ] Tests on **both** sides of every pair touched

Human-facing version of this map (for QA): Confluence *Related Feature Map — Change Impact &
Parity Checklist*, https://usebruno.atlassian.net/wiki/spaces/Bruno/pages/1376944136. Keep the two
in step: add new pairings to both, and remove unified ones from both.
