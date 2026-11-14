# The explorer

The web app (`packages/web`): a static React SPA over the dataset. Every page state lives in the URL.

## Shell

A question-first home: a search box over the ⌘K index, plus four entry tiles (The monolith, The microservices, Key flows, Change impact). A left rail groups the pages by question:

- **Understand:** Product areas, Architecture › Monolith / Microservices, Flows.
- **Change:** Resources, Impact.
- **People:** Ownership.

A breadcrumb and a right-hand detail panel for connections and endpoints complete the frame. The visual style is the Skello brand from `@skelloapp/skello-ds-web` ([ADR-0012](../adr/0012-skello-design-system.md)): Gellix, white surfaces, the DS semantic colours, with meaning carried by line style and colour kept for highlights and failure effects. `src/styles/ThemeBridge.tsx` writes the DS theme onto the app's CSS custom properties, so the CSS modules, the diagrams and the image export all read the DS values; it also sizes the DS type variants from `--text-*`, so DS components scale with present mode. Controls are DS components (`SkButton`, `SkIconButton`); keyboard focus draws a 2px outline, which the DS buttons do not draw themselves. At phone width the rail opens from a Menu button.

**Present mode** — `P`, the Present button or `?present=1` on any page hides the rail and the panel and enlarges the type for a shared screen; `Esc` exits.

## Product areas

There are 14 product areas (Planning, Time & attendance, Leave & requests…) plus the cross-cutting platform capabilities. Each area page answers:

- what the area is: a glossary anchored to the defining classes;
- where it lives: verified code locations per platform, with file counts;
- what to read first: an ordered reading path of flows;
- how it connects to other areas;
- which external systems it relies on.

Every flow carries a primary area. Its full area set is derived from its code-unit paths (`?page=areas&area=planning`). The areas home lists the external systems no single area claims (Stripe, Intercom, Segment, Metabase, Zelty) under "Shared by every area", with the repos that use them.

### Bugs

With a Jira overlay that names the area, the area page ends with a Bugs section, read from the local Jira snapshot ([discovery.md](discovery.md#jira-snapshot-and-overlay)):
- "N open · N past SLA · N opened in 90 days";
- a 13-week sparkline of bug reports opened per week, its last point hollow because the snapshot's week is partial;
- the area's Feature Areas, most open first, with open and past-SLA counts;
- the teams whose Jira boards hold its open bugs, and "No team" for bugs on no listed board;
- "Open in Jira", the same list as a Jira search;
- a footer naming the snapshot date, "stale" past 7 days.

A bug counts in the area of its first Feature Area, so the Jira search can show a few more bugs than the count: those whose second Feature Area names the area. The areas home adds "Bugs with no product area: N open" under the area grid, linking to those bugs in Jira, when there are some.

**No overlay.** Without `packages/web/overlay/jira.json`, or when it fails `JiraOverlaySchema`, the app shows no Bugs section and no unmapped line. The overlay is served like Datadog's: `pnpm dev` and `pnpm preview` only, never in the build.

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

Any of the 36 services, including the three client apps: the Vue web front, skello-mobile and the SkelloPunchClock tablet (both React Native).

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

### Delivery

With a delivery overlay present, the Exploring view of a service shows a Delivery section under the diagram and above Health (Presenting hides it). It reads one line, upstream to prod:

- the changes waiting on `staging`: the count, the oldest change's title (cut with an ellipsis past 48 characters, whole in its tooltip and accessible name) and its age in working days, a 0 dimmed;
- "Nothing on its way to prod" when no branch holds one;
- the last release, `in prod v1.31.0 · 9 Nov`, with its verdict (Regressed, Steady, Too recent) when the Datadog overlay holds that release's sha; "No release in prod" without one.

A "Late for prod" chip follows the heading when the oldest waiting change has waited 3 working days or more; its rule is in its tooltip and, for screen readers, in its text. The footer reads "Branches as of <day>" from the clone's last fetch, or "Branches never fetched by discovery". The rules are in [discovery.md](discovery.md#delivery-line).

**No overlay.** Without `packages/web/overlay/delivery.json`, when it fails `DeliveryOverlaySchema`, or for a service it does not name, the view shows no Delivery section.

### Health

With a Datadog overlay present, the Exploring view of a service shows a Health section under the diagram (Presenting hides it). It reads, from top to bottom:
- the state — Problem now, To dig into, Fell back, Healthy or No data — with the reasons behind it;
- three sparklines over 14 days: requests, 5xx and p95 latency; the hollow last point is the snapshot day, still partial, and a gap is a day with no reading;
- Monitors (a "noisy" tag marks a monitor that changed state 50 times or more in 7 days), SLOs with target and value, open Incidents, each linking to Datadog;
- Releases, each with a verdict: Regressed, Steady or Too recent.

The footer names the snapshot date. A snapshot older than 7 days reads "stale", and "Noisy counts may be low" appears when the events fetch hit its page cap. The states and verdict rules are in [discovery.md](discovery.md#datadog-snapshot-and-overlay).

**No overlay.** Without `packages/web/overlay/datadog.json`, or when it fails `DatadogOverlaySchema` (ignored, with one console error), the app shows no Health section and no Depth line, and behaves as without Datadog. A service the overlay does not name shows no Health section either.

The overlay is served by `pnpm dev` and `pnpm preview` only, from the gitignored `packages/web/overlay/`; the production build never includes it.

## Monolith

`?page=monolith` shows skello-app by product area.
- **Exploring:** a ranked table with bars for files, routes and tables, sortable by each, with the code no area claims yet as the last row.
- **Presenting:** a treemap sized by files, with small areas merged and unmapped code hatched.

The Connections view (`&s=skello-app`) shows skello-app's service views. Clicking an area opens its slice in the detail panel: controllers by route count, monolith tables, the services it calls, and its flows.

## Resource pages

The resources index keeps its filters in the URL: `&rkind`, `&rowner`, `&rsort`, `&orphans=1` (not in any flow) and `&cycles=1`, so Back from a resource restores them.

`?page=resources&resource=<id>` answers the change-impact question for one table, queue, topic, stream, bucket or store. It opens with "N services · M files · K flows", then lists:
- writers, readers, producers and consumers, grouped by service, each marked ✓ (code or config evidence) or ~ (authored flow edge only);
- feeds: the CDC relations that copy the table out to a stream, each with its target stream as a link;
- the DLQ, with its depth when the overlay has it: "N waiting";
- the ActiveRecord model and related tables;
- the flows touching the resource, with their CRUD.

**Depth line.** A queue page with an overlay shows "Depth: N now, M max over 14 days", from the DLQ depth series the snapshot holds. A DLQ shows the same line, and the source queue's page shows the DLQ's current depth beside its link.

### Table listeners

A table page adds three sections, each shown only when it has content, and lists Feeds among the relation sections above (with the Consumers rows' "→ target stream"):

- **Listeners** lists every callback, cascade (`dependent:`), `touch: true` and gem hook registered on the model in the order Rails runs them, each marked ✓ (resolved from source) or ~ (receiver named after the model, to review). The Listener event, Kind and Grade selects filter the list. A row shows its condition and links to where it is declared and where it is defined. Expanding a row lists its effects: the tables it writes (linked), the jobs it enqueues and the service objects it calls, each with its own grade.
- **Also changes** shows the tables a write reaches through listener effects, for one event at a time (create, update, destroy); the Cascade event chips select it and the cascade opens on update. The heading counts the tables reached across all events. Each hop names the listener, the write mode, the events the write covers and the next hops. ↻ marks a cascade that reaches the same table and event again. A hop whose write runs no listener reads "runs none, skips N listeners". An event with no downstream write reads "No table changes on <event>".
- **Write paths** lists the code sites that write the table, grouped by what the write runs: every listener, a hand-fired subset, validation listeners only, touch and commit listeners, no listener. Each site shows the call, its source link, the listeners it fires and the flows whose code units include its file.

The sections are permalink-backed: `&event` selects the Also changes event, `&listener` expands a listener, and `&lev`, `&lkind` and `&lgrade` set the Listeners filters.

`?page=resources` lists every resource by store, with kind and owner filters, a "not in any flow" toggle (the adoption backlog) and a "Cycles only" toggle that keeps the tables on a listener cycle. The Sort select orders cards by name, listeners, also changes or bypassing writes. Every Postgres table card shows three counts, 0 when there is none: listeners, also changes and bypassing writes, so a table written only by callback-skipping code ranks under the bypassing sort. Entry points: ⌘K resource entities, stores in the flow swimlanes and service views, and file views ("resources this file touches"). The registry behind these pages is described in [data.md](data.md#resource-registry).

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

**Team pages** are permalink-backed (`?page=ownership&team=team-salsa`) and searchable from ⌘K. Each owned service shows its CODEOWNERS evidence chips, its connection counts and a jump into the graph. A team page also lists the team's Jira boards (names from the Jira overlay, ids without it) and Datadog teams, each only when the team has some.

**Unowned services** are listed as the adoption call-to-action. Coverage grows with zero code changes as teams add CODEOWNERS wildcards.

## Renderers and export

Every architecture and flow diagram is one model, drawn by a choice of two renderers. The choice is switched from the diagram toolbar and kept in the URL (`&renderer=svg`; an old `&renderer=mermaid` link opens React Flow):
- **React Flow** (default): pan, zoom, drag;
- **plain SVG**.

**Export:**
- PNG from both; React Flow keeps dragged nodes. Flow swimlanes export too.
- SVG from the SVG renderer: a standalone file with the theme colours and font resolved.
- Copy Mermaid from either renderer: the diagram's Mermaid source, checked in tests against the `mermaid` parser.

A view a renderer cannot draw hides that option.

## Global search (⌘K)

One palette over every service, endpoint, connection, flow, product area, glossary term, external system, database, queue and table listener. Picking a result navigates to a permalink-backed view. An endpoint hit opens the endpoint list in the detail panel, scrolled to that endpoint.

A listener method or an enqueued job lands on its table's Listeners section with that listener's row open. A job's sublabel names the listener that enqueues it.

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

**Links:** the title, the rail, the breadcrumb, the home tiles, the home search results and the inline service, resource, flow, file and route names on pages and panels are links to their permalink (`NavLink`, on the DS `SkLink`), so a modified click or the context menu opens them in a new tab or copies the address.
