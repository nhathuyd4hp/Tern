---
paths:
  - "packages/app/**"
  - "packages/electron/**"
  - "packages/filestore/**"
  - "packages/schema/**"
  - "packages/schema-types/**"
  - "packages/converters/**"
---

# On-Disk DSL & Serialization Changes

Bruno persists everything users create — collections, requests, environments, folders, and
config — as plain-text files on the user's disk and in their Git repos. The only on-disk format is
**`.yml`** — OpenCollection YAML (`opencollection.yml`, `<name>.yml`, `folder.yml`,
`environments/*.yml`), handled by `packages/filestore/src/formats/yml`. The legacy `.bru` format
no longer exists. Plus `.env` files (`parseDotEnv`).

(`preferences.json` is app-level electron-store
state under `userData`, not part of a collection's on-disk contract, so it is out of scope here.)

These files outlive the version that wrote them: an older Bruno reads files written by a
newer one, teammates on different versions share the same repo, and users hand-commit these
files. **A change to the on-disk shape is a change to a public contract.** Get it wrong and
you break parsing, corrupt collections, or silently drop user data — on collections you
can't reach to fix.

The in-memory objects that become these files are often assembled far from the serialization
layer — in `electron` (IPC handlers) or `app` (Redux) — and handed to
`filestore`, which can't tell that a field's shape changed upstream. So a DSL-affecting
change can originate in *any* package on the data path, not just the format packages. Treat
this rule as in scope for changes anywhere the collection/request/environment/config object
is built, mutated, or serialized — the serialization packages plus `app`,
and `electron`, where these objects are assembled or read/written. Adding a
persisted field in app/electron without wiring it through `filestore` (both formats) and
`schema` silently drops or rejects data on save — the exact bug this rule guards against.

## Rules

**Avoid unnecessary DSL changes.** First ask whether the need can be met in memory, in the
UI, or as a derived value without touching the serialized shape at all — most enhancements
can. Only change the on-disk format when the data genuinely must persist.

**Additive and optional only.** A new field must be optional with a safe default, so files
without it still parse and behave. Never rename, remove, repurpose, or retype an existing
field, and never change its semantics — old files and old app versions depend on the
current meaning.

**Round-trip must be lossless.** `parse(stringify(x))` must equal `x`, and `stringify` must
never drop fields it doesn't recognize. A file written by a newer version, opened and
re-saved by an older one, must not lose the newer fields.

**Descriptions are string-only internally.** Every inline `description` field (headers, params,
assertions, variables, body entries, ...) is stored as a plain `string`. On the **yml** side,
parsers accept a bare string *or* a legacy `{ content }` object on read and normalize to the
string (`formats/yml/common/{headers,variables,assertions,actions}.ts`, `parseEnvironment.ts`,
`body.ts`); writers emit a bare string. This read-accepts-object / write-emits-string asymmetry is
an established convention — not a lossy round-trip — proven by `formats/yml/common/variables.spec.ts`.
New inline description-like fields should follow this
string-only shape.

*Exception — `docs` is not string-only.* Collection/folder documentation (`docs`) is written by
the **yml** layer as an **object** `{ content, type: 'text/markdown' }`
(`formats/yml/stringifyCollection.ts`, `stringifyFolder.ts`) and normalized back to a string on
read. So "follow the string-only shape" applies to
inline `description`, *not* to `docs`-style documentation fields — check which family a new field
belongs to before copying either pattern.

**Update every layer a field touches.** `schema-types` (types), `schema` (Yup validation),
`filestore` (parse and stringify), and `converters` (import/export) — a field handled in only some
of them is silently dropped. The default app-data workspace and custom-filesystem workspaces are a
twin too: a value that persists in one but is silently dropped in the other is the same class of
bug. Pay attention to the *unset* case: a field that defaults or persists differently on parse vs
stringify (e.g. one path returns `''`, the other `'1'`) is a divergence bug.

**`schema` (Yup) is not optional — it is the write-time allow-list.** The collection/request/
environment Yup schemas are declared `.noUnknown(true)` (not `.strict()`), and the save paths
persist the schema's **cast output**, not the object passed in (e.g. `itemSchema.validate` /
`environmentSchema.validate` in `app`'s `slices/collections/actions.js` and
`SaveTransientRequest`, which write the resolved `validatedItem` / `validatedEnvironment`). The
exception is `electron`'s `store/global-environments.js`, which uses `validateSync` only as
a pass/fail filter and keeps the original object. Two consequences:

- A serialized field that round-trips through filestore but is **not** modelled in
  `packages/schema` is **silently stripped on save** — no error, it is just gone from the
  user's file. Nothing fails loudly, so verify the field survives a save.
- A `.default()` in `schema` is **written to disk** whenever the field is unset (e.g. the ws
  `settings.timeout` default of `30000`). Only add a default you want persisted into every saved file.

`schema` (runtime Yup) and `schema-types` (TS types) are distinct and both must be updated.

**When a shape must change, migrate on read — never make users edit files.** Add a
read-time compatibility shim that upgrades the old shape as it is parsed, following the
existing pattern: `ensureAuthV3Rc1BackwardsCompatibility` in `formats/yml/parseItem.ts`. Gate any eventual removal
behind a major version bump and leave a dated `TODO(remove after vN)`.

**Design for scale and consistency.** New keys follow the naming and nesting of the existing
`meta`/section blocks (`meta.name`, `meta.seq`, `meta.type`, `meta.tags`, ...). Prefer
structures that extend cleanly — a keyed list over a positional one, an object over a
widening union — and match how neighbouring fields are already modelled. Note the on-disk
`meta {}` block does **not** map 1:1 to the type: in `schema-types` those keys are flattened
onto `Item` (`seq`, `name`, `type`, `tags`, `description` directly on the item).

**Name properties like they're permanent — because they are.** A DSL key is written once and
effectively forever: renaming it breaks every existing file and forces a compat shim. These
names are also user-facing — people read and hand-edit `.yml` — and are read by AI
agents reasoning over collections. Choose clear, descriptive, fully spelled-out names, with
no cryptic abbreviations or ambiguity, consistent with existing keys, and get it right the
first time. A property name deserves stricter scrutiny than an ordinary variable.

**Test the contract.** Add round-trip tests (parse → stringify → parse) for the new field,
plus a golden fixture of the *old* format that must still parse unchanged. The
paired `parseItem.spec.ts` / `stringifyItem.spec.ts` (and `parse*`/`stringify*` for collection,
folder, environment) next to each serializer in `filestore/src/formats/yml` are the pattern;
`common/variables.spec.ts` and `common/datatype.spec.ts` show field-level cases.

## A new persisted field — the files it usually touches

Adding a single field tends to span several packages:

- `filestore/src/formats/yml` — parse **and** stringify for the `.yml` side.
- `schema/src/collections/index.js` — the Yup schema (skip this and the field is silently stripped on save).
- `schema-types/src/collection/item.ts` — the TypeScript type.
- `converters` — a **separate field list from `filestore`**, not the same code path:
  `src/opencollection/items/{http,graphql,grpc,websocket}.ts` maps the field for the OpenCollection schema, might have typescript issues to be consulted with https://github.com/opencollection-dev/opencollection when needed
  export *and* import, and `src/postman/bruno-to-postman.js` for Postman export. A field wired
  through filestore but not here round-trips on disk and is silently lost on export.
- `app/src/utils/collections/index.js` — `transformRequestToSaveToFilesystem` and siblings
  whitelist fields before save; a field missing here never reaches the serializer.
- the collection utils in `electron` / `app` that build the object.
- Round-trip specs next to the serializers (`formats/yml/parseItem.spec.ts` + `stringifyItem.spec.ts`).

Find a comparable field already in the code and follow how it's wired before adding yours.

## Before changing the DSL — checklist

- [ ] Change is genuinely necessary (can't be solved in memory / UI)
- [ ] New field is optional with a safe default; nothing renamed, removed, or retyped
- [ ] Handled in `yml` parse **and** stringify
- [ ] Types (`schema-types`), Yup schema (`schema`), and converters updated —
      "converters" means `converters/src/opencollection/items/*` in **both** directions,
      which is a different field list from `filestore`
- [ ] Field survives the app save transform (see `feature-parity.md` §1)
- [ ] Old files still parse — read-time compat shim added if the shape changed
- [ ] Default vs custom workspace behave identically, including the unset case
- [ ] Round-trip + old-format fixture tests added
- [ ] Naming/structure consistent with existing blocks and scalable
