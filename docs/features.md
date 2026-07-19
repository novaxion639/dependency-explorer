# Flow Expressiveness — Features

---

## 1. Domain-rule model & registry

The Zod model and dataset registry for domain rules — the foundation every rule feature builds on, for flow authors.

**User flow**
1. A flow author adds a rule to `packages/data/src/rules.ts` with id, title, statement, source-of-truth ref, per-platform divergences, and source paths.
2. The author references the rule from a flow step or code unit via `ruleRefs`.
3. The author runs `pnpm check`; integrity tests verify every ref resolves, every source path exists, and no rule is orphaned.

**UI overview**
No page changes yet. The visible surface is the `pnpm check` output: a red test naming the unresolved ref, missing path, or orphan rule; green when the registry is consistent.

---

## 2. Flagship punch-domain rules

The overnight day-attribution and clock-in/shift-coupling rules authored as rule cards, for developers chasing punch bugs.

**User flow**
1. A flow author lifts the rule prose threaded through the three punch flow files into two structured rules.
2. The author records svc-punch's auto-close computation as source of truth, the web front's client-side mirror as a reimplementation divergence, and the tablet's offline-only open-badging guard as a platform divergence.
3. The author links the rules from the badging-review, employee-clock-in, and mobile-clock-in steps they govern.

**UI overview**
No new components — this feature is dataset content. Once feature 3 ships, these two rules are what its cards display.

---

## 3. Rule chips & rule cards

Rule knowledge becomes visible in the flow modal, for developers reading a flow.

**User flow**
1. A developer opens the badging-review flow.
2. Steps governed by a rule show a rule chip in the step list.
3. The developer clicks the chip and reads the rule card: statement, source of truth, and the divergence table by platform.

**UI overview**
A small chip on step-list rows carrying rules. Clicking opens a card panel over the flow modal: the rule title and statement on top, a table underneath with one row per platform showing its behavior and linked code unit, the source-of-truth entry highlighted.

---

## 4. Rule staleness watch

Rules flag themselves for re-review when their source files change upstream, for flow authors and leads.

**User flow**
1. At authoring time, the flow author stamps each rule with a content hash per source path.
2. Months later, someone changes the day-attribution service in the monolith.
3. The next `pnpm discover` run recomputes hashes and prints the rule as "needs re-review", naming the changed file.
4. The author re-reads the source, updates the statement if needed, and re-stamps.

**UI overview**
A new section in the `pnpm discover` terminal report: green when all rule sources match their stamps; per-rule warning lines with the drifted file path otherwise.

---

## 5. Feature-flag model

The typed flag reference model on code units and edges, for flow authors.

**User flow**
1. A flow author replaces a free-text flag mention with a typed ref: flag name, kind (product or dev, per the wrapping helper at the call site), and scope.
2. Non-flag guards stay in the free-text condition field.
3. `pnpm check` validates the shape; the six flag-carrying flows are migrated as the reference examples.

**UI overview**
No page changes yet. The flag data shows up in feature 7's chips and search entities.

---

## 6. Flag checker & derived registry

Flag refs are verified against source and aggregated into a flag→flows registry, for authors and the scanner.

**User flow**
1. A flow author runs `pnpm discover` after adding a flag ref.
2. The checker reads the owning unit's source file and confirms the flag name appears literally; a fabricated name goes red with the file path.
3. The build derives the registry mapping each flag to the flows it gates — nobody maintains it by hand.

**UI overview**
A flag section in the discovery report: confirmed refs counted, failures listed as flag-name → expected file. The registry itself is invisible plumbing until feature 7 renders it.

---

## 7. Flag chips & ⌘K flag search

Any flag becomes findable with the flows it gates, for developers asking "where does this flag matter?".

**User flow**
1. A developer hits ⌘K and types a flag name.
2. The palette shows the flag entity with its kind and gated-flow count.
3. Selecting it lands on the flag view listing those flows; each opens the flow directly.
4. Inside a flow's code detail, gated units and edges wear flag chips.

**UI overview**
A new flag result type in the ⌘K palette. The landing view is a compact list — flag name, kind badge, and the gated flows as clickable rows — backed by a shareable URL. Flag chips render alongside the existing guard text in the code-detail step list.

---

## 8. Failure model on async edges

The failure metadata shape for async edges, for flow authors.

**User flow**
1. A flow author annotates an async edge with its DLQ name and retry policy, or the explicit confirmed-missing waiver when the real queue has no DLQ wiring.
2. An optional human narrative describes what an error means for the user.
3. `pnpm check` validates the shape; idempotency is not a field anywhere.

**UI overview**
No page changes yet. The data feeds feature 9's audit and feature 10's badges.

---

## 9. DLQ extraction & the 🧯 audit

Serverless DLQ/retry facts are extracted and audited against the dataset, for authors and leads.

**User flow**
1. The scanner parses each service's serverless config across all three wiring shapes: raw RedrivePolicy blocks, DLQ-append factory arguments, and onFailure destinations with structured ARNs.
2. `pnpm discover` prints the 🧯 section: every in-scope async edge either matches an extracted DLQ fact, carries the confirmed-missing waiver, or is flagged.
3. A lead reads the section as a DLQ-standard audit — the svc-requests notification queues appear as confirmed-missing from day one.

**UI overview**
A 🧯 section in the terminal report: per-edge verdict lines (match, waived, mismatch, unknown), with a summary count that reads as compliance coverage.

---

## 10. Failure badges in the code view

DLQ protection becomes visible on the flow graph, for developers assessing blast radius.

**User flow**
1. A developer opens a flow's code detail.
2. Async edges into services wear a shield badge when a DLQ is wired, and a warning badge when the failure record says confirmed-missing.
3. Hovering shows the DLQ name and retry policy; the ~16 in-scope edges are backfilled.

**UI overview**
First edge-badge rendering in the code-detail view — small icons on async edge labels, color-coded by protection state, consistent with the existing sync/async edge styling.

---

## 11. Auth model

The trigger and per-edge auth shapes, for flow authors.

**User flow**
1. A flow author states who triggers a flow: actor and role, one line per flow.
2. On service-bound edges, the author records the token type (existing auth enum), the permission gate name, or the explicit no-authorizer signal.
3. Token-lifecycle nuances stay prose — the schema names that boundary.

**UI overview**
No page changes yet. The data feeds features 12 and 13.

---

## 12. Authorizer extraction & gate checker

Auth declarations are extracted from serverless config and gate names verified in source, for authors and the scanner.

**User flow**
1. The scanner captures per-route authorizer declarations in both syntaxes found in the repos.
2. `pnpm discover` cross-checks authored edge auth against extracted facts and greps gate names in the owning controller's source.
3. A fabricated gate name goes red with the controller path; routes with no authorizer are reported as such, never guessed.

**UI overview**
An auth section in the terminal report: extraction counts per service, verified/failed gate refs, and an auth-coverage figure that grows as edge-level backfill proceeds domain by domain.

---

## 13. Trigger backfill & auth chips

Every flow answers "who can trigger this?", and the punch auth chain becomes typed, for developers.

**User flow**
1. A developer opens any of the 39 flows and reads its trigger line: the actor and role that initiate it.
2. Opening punchclock-device-setup, the developer sees the three-tier chain — manager login, employee token, shop-scoped device JWT — as typed chips on the edges.
3. Remaining edge-level coverage grows domain by domain, tracked in the report.

**UI overview**
A trigger line in the flow modal header. Token-type and gate chips on step-list rows for edges carrying auth data, following the chip pattern established by rules and flags.

---

## 14. Composition-link model

The kind-qualified flow-to-flow link shape, for flow authors.

**User flow**
1. A flow author adds a link on the upstream flow: target flow id plus kind — continuation, writes-back-to, same-journey, or domain-related.
2. The reverse direction is derived at build time; only one direction is ever authored.
3. `pnpm check` verifies every target id resolves.

**UI overview**
No page changes yet. The links render in feature 15.

---

## 15. Flow-to-flow navigation

Related flows become one click apart, for developers tracing a chain across the catalog.

**User flow**
1. A developer opens employee-clock-in and sees "continues in → badging-review".
2. One click opens the downstream flow; its header shows the derived "← triggered by" back-link.
3. The 13 existing prose cross-references are migrated to typed links, each with the kind that matches its real relationship.

**UI overview**
Link chips in the flow modal header and flow list, labeled by kind so a strict continuation never reads the same as a loose domain relation.

---

## 16. Generated inventory docs

The inventory docs regenerate from the dataset and CI refuses drift, for flow authors and leads.

**User flow**
1. A flow author adds a fortieth flow.
2. The docs generator rewrites the generated sections of the two inventory docs — counts, lists, per-domain attribution — between markers, leaving analysis prose untouched.
3. If the author forgets to regenerate, `pnpm check` fails with a diff.

**UI overview**
No app changes. The visible surfaces are the two markdown docs with clearly marked generated sections, and the CI failure message showing the expected regeneration.

---

## 17. Authoring-guide code-layer chapter

The guide documents every schema field a flow author can use, written last so it covers the final set.

**User flow**
1. A new contributor reads the flow-authoring guide before their first flow.
2. The code-layer chapter walks through units, edges, modes, guards, and every field this release adds — rules, flags, failure, auth, links — with the checker each one answers to.
3. The contributor authors a flow without reverse-engineering the schema from existing files.

**UI overview**
Documentation only: a new chapter in `docs/flow-authoring-guide.md` replacing the schema reference that predates the code layer.

---

## 18. Reverse code→flows search

A source-file path answers "which flows cross this file?", for developers mid-incident or mid-refactor.

**User flow**
1. A developer about to change a monolith service hits ⌘K and types the file name.
2. Flow results matching the path surface immediately; the file entity shows "touched by N flows".
3. Selecting it lands on the list of those flows; each opens with its code layer highlighted.

**UI overview**
File paths join the flow search haystack, plus a file result type in ⌘K with a landing list view backed by a shareable URL. No new authored data anywhere — the index derives from what flows already declare.

---

## 19. PII surface — decorator scan & edge refs

Payload PII becomes visible where a hop carries it, with decorator-backed facts only, for developers and leads assessing data exposure.

**User flow**
1. The scanner sweeps skello-libs-ts for lib-anonymizer decorators: PII-typed fields become facts, @NoAnonymizer fields count as explicitly non-PII, and name-matching fields in packages without decorators list as review-assist candidates.
2. A flow author declares `pii` classes on an edge only when the target SDK decorator-types those fields; `pnpm discover` rejects any class the decorators do not back.
3. A developer opening a flow's code detail sees a 🧬 badge on carrying edges — the user-replication syncs show email/name/phone, while the punch documents themselves show nothing, because they carry nothing.
4. A lead reads the candidate list as the lib-anonymizer adoption backlog.

**UI overview**
A pink 🧬 badge on code edges whose payload carries PII, with the classes in the tooltip. The report section carries the decorator coverage stats, edge verification counts, and the capped candidate list.

---

---
