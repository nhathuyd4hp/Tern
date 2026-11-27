# Architecture, Data Model & Dependencies (reference)

On-demand reference for the monorepo layout, the request pipeline, the sandbox, the core
data-model types, and dependency versions. This file is **not** auto-loaded — read it before
non-trivial cross-package or architectural work. The dependency DAG and ownership guardrails
(the invariants Claude must not break) live in the auto-attached rule
`.claude/rules/architecture.md`; the area-specific rules (`.claude/rules/electron-ipc.md`,
`.claude/rules/redux-store.md`, `.claude/rules/dsl-changes.md`) go deeper. This file is the map.

## Monorepo structure (npm workspaces)

```
packages/
  app/          React renderer (rsbuild, Redux Toolkit, styled-components)   [name @tern/app]
  electron/     Electron main process (electron-builder)                     [name "bruno" — NOT scoped]
  js/           JS sandbox for user scripts (QuickJS + node:vm)
  common/       Shared utilities — the base leaf (rollup → dist/cjs+esm)
  converters/   Import/export (Postman, Insomnia, OpenAPI, …) (rollup)
  requests/     Shared HTTP/gRPC/WS request building blocks (rollup)
  filestore/    .yml serialization (rollup + tsc --emitDeclarationOnly)
  sqlite/       Local SQLite SDK — main-process only (codegen + rollup)
  query/        JSONPath-style query engine (rollup)
  schema/       Yup runtime validation of collections/requests
  schema-types/ TypeScript type definitions only (tsc, types-only)
  graphql-docs/ GraphQL documentation generator (rollup)
```

Build tool per package (matters for the "rebuild shared packages" step in `.claude/CLAUDE.md`):
- **rollup** (emits `dist/cjs` + `dist/esm`): common, converters, requests,
  query, graphql-docs; **filestore** additionally runs
  `tsc --emitDeclarationOnly`;
  **sqlite** additionally runs a codegen prepass (`npm run generate`) that compiles
  `migrations/*.ts` + `statements/*.sql` into the gitignored `src/generated/`.
- **tsc only**: schema-types.
- **rsbuild**: app.
- **no build step (consumed straight from `src/`)**: js, schema,
  electron.

The 8 packages that must be rebuilt after editing (they emit `dist/`): common,
requests, filestore, sqlite, converters, query,
graphql-docs, schema-types. Editing js / schema
needs no rebuild.

## Dependency direction & ownership boundaries

The internal `@tern/*` dependency DAG and the guardrails that protect it (common
browser-safe, js Electron-free, schema vs schema-types, no upward imports) are the
auto-loaded rule — see `.claude/rules/architecture.md`.

## Request execution pipeline

1. Renderer invokes `ipcMain.handle('send-http-request', …)` (`electron/src/ipc/network/index.js`).
2. Variables are interpolated via `interpolate` from `@tern/common`
   (`ipc/network/interpolate-vars.js`).
3. Pre-request scripts run via `ScriptRuntime` (`js/src/runtime/script-runtime.js`).
4. The request is built/sent — axios for HTTP, plus gRPC (`@grpc/grpc-js`) and WebSocket clients;
   shared building blocks (auth interceptors like `addDigestInterceptor`/`applyOAuth1ToRequest`,
   cookies, `scripting.buildScriptedEntry`, grpc/ws helpers) come from `@tern/requests`.
   requests is a *library of request pieces*, not the orchestrator — orchestration lives in
   `ipc/network`.
5. Post-response: **var extraction** via `VarsRuntime`, **tests** via `TestRuntime`, and
   **assertions** via `AssertRuntime` (all in `js/src/runtime/`) — these are distinct
   runtimes, not `ScriptRuntime`.
6. Result is returned to the renderer as a data object with an `error` field on failure (the
   handler does not reject — see `.claude/rules/electron-ipc.md` error convention).

## Script sandboxing (`js`)

- **QuickJS** (default / "safe" mode): WebAssembly sandbox via `quickjs-emscripten`
  (`src/sandbox/quickjs/`).
- **Node VM** ("developer" mode): `node:vm` `runInContext` (`src/sandbox/node-vm/`).
- Runtime selection is centralized: `getJsSandboxRuntime` maps
  `collection.securityConfig.jsSandboxMode` (`'safe'` default → `SANDBOX.QUICKJS`; `'developer'`
  → `SANDBOX.NODEVM`) — see `js/src/utils/sandbox.js` and `ipc/network/index.js`. Route new
  sandbox-mode logic through `getJsSandboxRuntime`; do not re-derive the mapping.
- Scripts get a `bru`, `req`, `res` (post-response only), `test`, `expect` (chai), `assert`
  (chai), and `console` context (`script-runtime.js`).

## File format system

- `filestore` is the central parse/serialize entry (`src/index.ts`), delegating to
  `formats/yml`.
- The only on-disk format is **`.yml`** (OpenCollection YAML; `DEFAULT_COLLECTION_FORMAT = 'yml'`).
- Collections live on the filesystem and are watched by chokidar.

Any on-disk shape change → follow `.claude/rules/dsl-changes.md`.

## Local persistence (not collection files)

Two distinct mechanisms — pick by what the data is:

- **`@tern/sqlite`** (`bruno.db` under `userData`) — the SDK for derived/bulky secondary state.
  Migrations (`migrations/*.ts`) and statements (`statements/*.sql`) are authored and compiled into
  a typed layer for the main process. `services/sqlite` owns the DB, and `ipc/sqlite.js` exposes
  selected statements to the renderer, one hand-written handler per statement on
  `datastore:<statement_file>:<statement_name>`. Full guide: `.claude/rules/sqlite.md`.
- **electron-store JSON** (`electron/src/store/`) — preferences and small keyed app state;
  see `.claude/rules/electron-ipc.md`.

## Redux store (app side)

The authoritative slice list is the `reducer` map in
`app/src/providers/ReduxStore/index.js` (~11 slices; `collections/` is by far the largest).
Conventions, middleware, and side-effect boundaries: `.claude/rules/redux-store.md`.

## Providers (`app/src/providers/`)

Read the directory for the current set: `App/`, `ReduxStore/`, `Theme/`, `Hotkeys/`, `Toaster/`,
`PromptVariables/`.

## Key types (`schema-types`)

Core types live in `packages/schema-types/src/` — read them for the current shapes. The
top-level request is a union: `Request = HttpRequest | GrpcRequest | WebSocketRequest`
(`requests/index.ts`); code that handles "a request" must account for all three. Other central
types: `Collection` (`collection/collection.ts`), `Item` (request or folder, discriminated by
`type`, `collection/item.ts`), `Auth` (a `mode` union, `common/auth.ts`), `KeyValue` (headers /
params / assertions, `common/key-value.ts`), `Environment`, `Script`.

## Key dependencies (actual majors — verify in the relevant `package.json` before assuming)

Several are pinned to majors below the latest — do **not** assume the newest API:

- Frontend (`app`): **react 19**, **@reduxjs/toolkit ^1.8 (v1, NOT v2)**,
  **react-redux ^7 (v7)**, **styled-components ^5 (NOT v6)**, **tailwindcss ^3**,
  **@rsbuild/core ^1.1**, **codemirror 5.65.2 (CodeMirror 5, NOT the scoped `@codemirror/*`)**.
- Desktop (`electron`): **electron ~43.8**, **electron-builder ^26.18**, **chokidar ^3.5**,
  **@grpc/grpc-js ^1.13**, **js-yaml ^4.1**, **electron-store ^8.1**. (`ws` is a dep of
  requests, **not** electron.)
- Storage (`sqlite`): no runtime dependencies — the driver is Node's built-in **`node:sqlite`**
  (synchronous `DatabaseSync`); **tsx** is build-time (codegen) only.
- **Hard pins in root `package.json` `overrides`: axios `1.16.0`, rollup `3.30.0`.** Bumping these
  in a leaf package has no effect — change the root override.
- **TypeScript is not uniform**: common `^5.8`, schema-types `^5.0`, but
  converters/filestore/io/graphql-docs/query/requests are `^4.8`. There is no root TS dep.
