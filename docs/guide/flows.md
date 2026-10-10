# Flows

48 verified end-to-end flows: shift creation, auto-planning generation, the leave lifecycle, tablet and mobile clock-in, device setup, mobile app launch, mobile-only shift swaps… Each one has its own page (`?page=flows&flow=<id>`). To author one, follow the [flow authoring guide](../flow-authoring-guide.md); coverage of user actions is tracked in [planning-actions-coverage.md](../planning-actions-coverage.md).

## The flow page

**Header:**
- the trigger (👤) and the product areas;
- a one-sentence summary, with the rest of the description under "more";
- related flows;
- 🚩 flags and 📐 domain rules.

**Exploring**, the flow is drawn as swimlanes.

*Lanes:*
- Each service gets a request lane: controllers, services, managers, model callbacks, UI components, HTTP clients.
- A service with jobs also gets a background lane for them.
- One lane holds the stores (PostgreSQL, MongoDB, SQS, DynamoDB, on-device SQLite…), and one holds the services without code units.

*Order and lines:*
- Units stack top to bottom in call order, sync calls before async ones.
- Lines are solid for sync, dashed for async, dotted for a data feed out of a store, and run at right angles.
- Between neighbouring units of one lane a line runs straight down; repeated lines between the same pair stack their labels. Otherwise it runs through the gutters between lanes, where its full label sits clear of nodes, other labels and arrowheads.
- Labels wrap to the gutter's width at word breaks, then inside a long identifier after `_ . # / ::` or at a camelCase boundary, never inside a character.
- A gutter widens, and the gap above a row opens, when more lines need them than they hold.
- Units sit inside their lane and stay in place while the canvas pans and zooms.
- Edge conditions and feature flags show as "if" pills, and branches as `⎇` lines on their unit.

**Presenting**, the same diagram sits beside a story of 3–12 authored chapters, at least one per two units or stores (`&chapter=<n>`). The arrow keys step through them: the selected chapter keeps its units, stores and services, dims the rest, and the view zooms onto them (no closer than about 1× in React Flow and SVG; exports keep the whole flow). Chapters follow the [authoring guide](../flow-authoring-guide.md#chapters); a flow without them shows chapters derived from its steps.

**Clicking:**
- a unit opens it in the detail panel (`&unit=<id>`);
- a store opens its resource page, or the panel when it maps to no registered resource.

**Two flow shapes carry extra detail:**
- Page-load flows group their steps into ordered phases.
- The punch flows carry the overnight-shop day-attribution rules on both the client and server sides.

In any flow, web and mobile divergences are recorded wherever the two clients implement the same feature differently.

## The code layer and its grades

Every flow carries a code layer: the units an action traverses.
- **Backend units:** controllers, service objects, managers, Sidekiq jobs, model-callback groups.
- **Client-app units:** UI components and HTTP client wrappers.

The layer is human-authored from code reading (assisted by `pnpm discover:trace <file>`) and machine-verified by `pnpm discover`:
- **Unit paths:** every unit's file path must exist (🫀 report section).
- **Edge grades:** `--pinned` runs grade every unit → unit call edge from the graphify AST graph built at the pinned commit. A graph built at another commit is never used.

| Grade | Evidence |
|---|---|
| `graph` | A calls/references path, or a `src/container.ts` injection path, within two hops |
| `constant` | The caller names a class the callee file declares |
| `import` | An import resolves to the callee file (through the caller's own app aliases, index files and barrels too), or a Vuex namespace, an emitted event, or a Vue-router route name the navigating caller writes wires them |
| `text` | A name match only, or a Rails receiver named after the callee's model: the review backlog |
| `none` | No evidence: a finding |

An edge into the monolith is also graded through the route table:
- a URL written in the caller whose full path routes to the callee controller is `import`;
- a URL found only in a file the caller imports, or a route tail only that controller owns, is `text`.
- with no pinned skello-app, edges into it are skipped, like the edges of an unpinned caller.

The full rules are in the Verified Paths spec (`docs/specs/VerifiedPaths.md` in the shared docs).

**Branches** are alternative outcomes (409 lock held, 422 not pending…). Each anchors to a code unit by a literal that 🔀 verifies in the pinned source.

## Unit detail panel

Clicking a unit in the swimlanes opens its story in the detail panel:
- its kind and service;
- the file at the pinned commit (a GitHub link with the short sha);
- the full description, its 🚩 flags, the 📐 domain rules it implements, and its `⎇` branches;
- the other flows crossing the same file;
- every call in and out, with:
  - mode, transaction, CRUD and condition;
  - evidence grade: ✓ verified in the call graph · ~ name match only · ✗ no evidence;
  - 🔑🛡🧬📜 annotations.

A store shows its type and its resources, each opening its resource page.

## Domain-rule cards

Cross-flow business rules (overnight day attribution, clock-in/shift coupling) are first-class cards. Each card has:
- a human-owned statement;
- a named source-of-truth code unit;
- a per-platform divergence table (backend / monolith / web / mobile / tablet).

Flow steps and code units reference rules, and 📐 chips on the flow page open the card. Integrity tests gate every ref.

The discovery scanner verifies every rule source path on disk and recomputes each path's sha256 staleness stamp. An upstream source change flags the rule "needs re-review", with the new hash to re-stamp (📐 report section).

## Feature-flag registry

Flow code units and edges carry typed flag refs:
- `kind` is `product` or `dev`, authored from the call-site helper and never inferred from the name.
- The flag → flows registry is derived at build time.

**Where flags show:**
- 🚩 chips on the flow page;
- a ⌘K entity type for flags, landing on a page of the flows each flag gates (`?page=flows&flag=FEATUREDEV_X`);
- a 🚩 discovery section that verifies every flag name appears literally in its unit's source.

## Failure and resilience

Async code edges into services carry their failure semantics:
- **Facts:** the queue, its DLQ and its retry policy. They are extracted from serverless config and the `*-tf` estate: RedrivePolicy blocks, `createSqs` factory args, `onFailure` destinations, Terraform `dlq_name`.
- **Waiver:** an explicit `confirmed-missing` where no DLQ wiring exists.
- **Narrative:** a human-owned `onError`.

🛡/⚠ facts show on the calls in the unit detail panel. The 🧯 discovery section audits every in-scope edge and doubles as an org DLQ-standard audit.

## Auth and permission context

Every flow states who triggers it: a 👤 chip on the flow page, whose presence the integrity suite enforces.

Code edges carry typed auth refs:
- the token type;
- a permission gate, whose literal is verified in the edge's unit sources;
- a named gateway authorizer, verified against the extracted serverless declarations (both syntaxes in the estate);
- or an explicit `no-authorizer-configured` record, for routes that authenticate inside the Lambda.

🔑 facts show on the calls in the unit detail panel, and the 🔐 discovery section checks them. Token-lifecycle facts stay prose: a named boundary of the schema.

## Flow composition links

Flows link to each other through kind-qualified relationships: `continuation` · `writes-back-to` · `same-journey` · `domain-related`. Each link is authored in one direction, and the reverse is derived. Clickable chips on the flow page turn the cross-references into navigation.

## PII surface

Code edges declare the PII field classes their payload carries (`pii: ["email", "firstName", …]`). They are authored only where the target SDK types the field through `@skelloapp/lib-anonymizer` decorators. 🧬 badges mark the carrying edges.

The 🧬 discovery section:
- verifies every ref against the decorator scan;
- counts the explicitly non-PII surface (`@NoAnonymizer`; the punch documents themselves carry none, by design);
- lists name-heuristic candidates in packages without decorator coverage, as the decorator-adoption backlog. These are review aids, never facts.

## Reverse code → flows index

⌘K accepts a source-file path and answers two questions: which documented flows traverse this file, and which routes it serves. For example, `?page=flows&file=skello-app/app/controllers/v3/api/plannings/shifts_controller.rb`.

The answer is derived from the code layer's unit paths and the monolith routes. A route opens the endpoint list in the detail panel.
