# The explorer

The web app (`packages/web`): a static React SPA over the dataset. Every page state lives in the URL.

## Shell

A question-first home: a search box over the ⌘K index, plus four entry tiles (The monolith, The microservices, Key flows, Change impact). A left rail groups the pages by question:

- **Understand:** Product areas, Architecture › Monolith / Microservices, Flows.
- **Change:** Resources, Impact.
- **People:** Ownership.

A breadcrumb and a right-hand detail panel for connections and endpoints complete the frame. The visual style is Paper: ink on warm paper, with meaning carried by line style and colour kept for highlights. At phone width the rail opens from a Menu button.

**Present mode** — `P`, the Present button or `?present=1` on any page hides the rail and the panel and enlarges the type for a shared screen; `Esc` exits.

## Product areas

There are 14 product areas (Planning, Time & attendance, Leave & requests…) plus the cross-cutting platform capabilities. Each area page answers:

- what the area is: a glossary anchored to the defining classes;
- where it lives: verified code locations per platform, with file counts;
- what to read first: an ordered reading path of flows;
- how it connects to other areas;
- which external systems it relies on.

Every flow carries a primary area. Its full area set is derived from its code-unit paths (`?page=areas&area=planning`). The areas home lists the external systems no single area claims (Stripe, Intercom, Segment, Metabase, Zelty) under "Shared by every area", with the repos that use them.

## Microservices overview

**Exploring**, the page is an area map:
- the clients band on top, the monolith column on the left;
- the 14 product areas with their services in a grid;
- the 6 platform areas in a bottom band.

Selecting an area (`?page=microservices&area=planning`) draws its connections to every other group, one labelled edge per group and mode, and dims the rest; the detail panel shows the area slice.

**Presenting**, it becomes the weighted area graph:
- product areas as nodes, with connections aggregated area to area (thickness = count);
- clients and platform as summary bands;
- a slider that hides weaker edges (24 at most by default);
- `←` / `→` step the spotlight through the areas.

## Service view

Any of the 37 services, including the three client apps: the Vue web front, skello-mobile and the SkelloPunchClock tablet (both React Native).

**Exploring**, the service's neighbours sit in groups by how they talk: the clients and services that call it, what it calls, what it notifies over SNS, and who copies its data over CDC.
- Each group and mode gets one labelled edge: solid for sync, dashed for async, dotted for a data feed; thickness is the connection count.
- The service's own stores sit inside its card.

**Presenting**, its neighbours sit in product-area boxes around it. Each name is marked ← calls it · → it calls · ⇄ both · ⇠ copies its data.

**Connections** cover:
- REST and SQS/SNS/Kinesis;
- shared-database couplings (`mongodb`/`postgresql`);
- CDC replication: the `skelloapp-bus` DMS backbone and cross-service DynamoDB streams, discovered from serverless config;
- `s3` bucket-notification couplings.

**Clicking:**
- a neighbour lists its endpoints in the detail panel;
- an edge label lists the connections behind it, each opening the exact endpoints it uses;
- a store opens its resource page.

Discovered recurring tasks (⏰ EventBridge schedules) show with the endpoint list.

## Monolith

`?page=monolith` shows skello-app by product area.
- **Exploring:** a ranked table with bars for files, routes and tables, sortable by each, with the code no area claims yet as the last row.
- **Presenting:** a treemap sized by files, with small areas merged and unmapped code hatched.

The Connections view (`&s=skello-app`) shows skello-app's service views. Clicking an area opens its slice in the detail panel: controllers by route count, monolith tables, the services it calls, and its flows.

## Resource pages

`?page=resources&resource=<id>` answers the change-impact question for one table, queue, topic, stream, bucket or store. It opens with "N services · M files · K flows", then lists:
- writers, readers, producers and consumers, grouped by service, each marked ✓ (code or config evidence) or ~ (authored flow edge only);
- feeds: the CDC relations that copy the table out to a stream, each with its target stream as a link;
- the DLQ;
- the ActiveRecord model and related tables;
- the flows touching the resource, with their CRUD.

### Table listeners

A table page that has ActiveRecord callbacks adds four sections:

- **Listeners** lists every callback registered on the model in the order Rails runs them, each marked ✓ (resolved from source) or ~ (receiver named after the model, to review). The Event, Kind and Grade selects filter the list. A row shows its condition and links to where it is declared and where it is defined. Expanding a row lists its effects: the tables it writes (linked), the jobs it enqueues and the services it calls, each with its own grade.
- **Also changes** shows the tables a write reaches through listener effects, for one event at a time (create, update, destroy). Each hop names the listener, the write mode and the next hops. ↻ marks a cycle back to a table already on the path. A hop whose write runs no listener reads "runs none, skips N listeners". An event with no downstream write reads "No table changes on <event>".
- **Write paths** lists the code sites that write the table, grouped by what the write runs: every listener, a hand-fired subset, validation listeners only, touch and commit listeners, no listener. Each site shows the call, its source link, the listeners it fires and the flows whose code units include its file.
- **Feeds** is described above.

The sections are permalink-backed: `&event` selects the Also changes event, `&listener` expands a listener, and `&lev`, `&lkind` and `&lgrade` set the Listeners filters.

`?page=resources` lists every resource by store, with kind and owner filters, a "not in any flow" toggle (the adoption backlog) and a "Cycles only" toggle that keeps the tables on a listener cycle. The Sort select orders cards by name, listeners, also changes or bypassing writes. A table card with listeners shows three counts: listeners, also changes and bypassing writes. Entry points: ⌘K resource entities, stores in the flow swimlanes and service views, and file views ("resources this file touches"). The registry behind these pages is described in [data.md](data.md#resource-registry).

## Impact

`?page=impact&blast=<service | resource id>` opens "If X is down": what depends on X, hop by hop. Without an origin, the page asks for a service or a resource.

**Effects:**
- for a service: sync callers **fail**, async producers **degrade** (messages pile up), async consumers **starve**;
- for a resource: its writers, readers and producers fail, and its consumers starve.

**Hops:** hop 1 is definite. Failures further out read "may fail": a caller loses only its calls to X, and the map does not know which of its own endpoints depend on them. "Hard failures (sync)" filters to the sync chain.

**Affected flows** are those calling X directly (or, for a resource, through a direct dependent), each with the step where it breaks.

**Entry points:** the service header and every resource page ("If this is down…"). "Show on the map" folds out the microservices area map, with the origin inked and every impacted service in its effect colour.

## Ownership

Per-team service ownership is resolved from CODEOWNERS:
- A service is assigned to a team when its wildcard (`*`) line names exactly one product team.
- Path-rule frequency is not ownership, and process squads and the team-dev catch-all are excluded.

**Team pages** are permalink-backed (`?page=ownership&team=team-salsa`) and searchable from ⌘K. Each owned service shows its CODEOWNERS evidence chips, its connection counts and a jump into the graph.

**Unowned services** are listed as the adoption call-to-action. Coverage grows with zero code changes as teams add CODEOWNERS wildcards.

## Renderers and export

Every architecture and flow diagram is one model, drawn by a choice of three renderers. The choice is switched from the diagram toolbar and kept in the URL (`&renderer=svg|mermaid`):
- **React Flow** (default): pan, zoom, drag;
- **plain SVG**;
- **Mermaid**: lazy-loaded, with its own layout.

**Export:**
- PNG works from all three; React Flow keeps dragged nodes. Flow swimlanes export too.
- SVG from the SVG renderer: a standalone file with the Paper colours resolved.
- Copy Mermaid from the Mermaid renderer.

A view a renderer cannot draw hides that option; the monolith treemap, for example, has no Mermaid form.

## Global search (⌘K)

One palette over every service, endpoint, connection, flow, product area, glossary term, external system, database and queue. Picking a result navigates to a permalink-backed view. An endpoint hit opens the endpoint list in the detail panel, scrolled to that endpoint.

⌘K also accepts a source-file path: see [the reverse code → flows index](flows.md#reverse-code--flows-index).

## Permalinks

Every view state is encoded in the query string:
- a `page` key: `home`, `areas`, `microservices`, `monolith`, `flows`, `resources`, `impact` or `ownership`;
- the page's own keys: `area`, `term`, `s`, `flow`, `unit`, `chapter`, `file`, `flag`, `resource`, `blast`, `team`;
- the detail-panel keys: `edge` (one or more `from~to~protocol` keys joined by `,`), `drawer`, `ep`;
- `area` on the architecture pages (spotlight and slice);
- `renderer`.

Older links still open the equivalent page: `?view=…`, a bare `?s=…`, `?flow=…`, `?blast=1&s=…`, `&detail=code|sequence`.

**History:** picks (a new page, area, service, flow, connection or impact origin) push a history entry, so Back undoes them; closing a panel replaces the entry. A URL keeps only the keys its page uses.
