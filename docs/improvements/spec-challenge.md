# Spec Challenge — Flow Expressiveness plan

Adversarial evaluation of the Flow Expressiveness plan (five improvement axes for the flow
documentation), run with the `skello-beta-blueprint` find→verify protocol: lens finders propose
candidate holes, independent verifiers attempt to refute each against the spec/code, only
surviving holes are confirmed. Two passes — **intrinsic** (spec alone) and **reality** (spec vs.
grounded code). 2026-07-19.

Panel volume: intrinsic 63 candidates → 18 verified → **15 confirmed** (3 refuted); reality
9 candidates verified → **7 confirmed** (2 refuted). The bounce threshold (≥3 blockers) fired;
resolutions below were adopted at the gate and the cut proceeds on the amended plan.

---

## Intrinsic pass — confirmed blockers (with adopted resolutions)

| # | Lens | Hole | Adopted resolution |
|---|---|---|---|
| B1 | verifiability | `idempotent` declared an extractor-owned fact with zero extraction path — it would be the dataset's first unverifiable-claim class (three lenses converged on this) | **Cut `idempotent` from the failure object.** `onError` remains the only human-owned narrative field |
| B2 | completeness | The 🧯 DLQ checker has no waiver state: a service genuinely lacking a DLQ (the gap the audit exists to find) makes the dataset permanently red or forces fabricated data | `dlqAbsent: 'confirmed-missing'` annotation — the truth is representable; the report flags it as an org-standard violation while the dataset stays green |
| B3 | consistency | "Each feature independently `pnpm check`-green" contradicts "checkers land before backfill (red-to-green)" | **Checker-split doctrine stated:** source-verifying checkers (DLQ match, flag literals, rule sourcePaths, auth gates) live in `pnpm discover` (local, sibling repos on disk); `pnpm check`/CI gates only self-contained integrity. Grounding confirmed this split already exists structurally (discover.ts vs package.json `check`) |
| B4 | completeness | Axis D's `trigger`/auth fields never marked optional — if required, the tier plan breaks (integrity red from F4 until F16) | **Invariant stated: every new field across all axes is optional.** T1 lands with zero dataset changes |
| B5 | data-&-state | No re-extraction cadence or owner — extracted facts go stale because upstream repos never notify this one | New facts carry the existing Provenance/lastVerified stamps; cadence rides the tracked nightly-drift-PR thread (Infra org-token discussion) |
| B6 | data-&-state | Human-owned narratives rot silently behind a verified badge — structural checks pass while meaning drifts | Rule cards stamp a content hash of each `sourcePaths` file; hash drift surfaces as "rule needs re-review" in the discovery report |

## Intrinsic pass — confirmed majors

| Lens | Hole | Disposition in the cut |
|---|---|---|
| completeness | "Async edge" classification prerequisite undefined | Refuted by grounding in practice: `FlowCodeEdge.mode` (`sync\|async-job\|async-event`) already exists — the checker keys on it. Recorded as spec-wording fix |
| completeness | CI/local access to sibling-repo sources for the new checkers unaddressed | Resolved by the B3 checker-split doctrine |
| edge-cases | Legitimately DLQ-less async invocations make the dataset un-green | Resolved by B2's waiver |
| edge-cases / consistency | `idempotent` extraction path absent (duplicates B1) | Resolved by B1's cut |
| missing-axes | **No flow-to-flow composition axis** — the 39 flows are isolated islands while the punch domain plainly fans out | **Promoted to milestone M5.** 12 cross-flow references already exist in flow prose — demand is proven in the dataset itself |
| missing-axes | **No PII/data-sensitivity axis** despite the plan marketing a compliance-audit angle | Evaluated via grounding; kept OUT of the cut (see Deferred, roadmap §9) — name-heuristic density is too uneven for an authoritative tagger (payroll/HRIS SDKs, the highest-stakes domains, have the lowest field-name hit density) |
| missing-axes | **No reverse code→flows index** — file → "which flows traverse this" | **Promoted to milestone M7.** Purely derived from existing `codeUnits[].path`; zero new authored data |

---

## Reality pass — confirmed holes (spec vs. grounded code)

| Lens | Hole | Disposition in the cut |
|---|---|---|
| ui-reality | **Code-graph edge labels/badges do not render** — the ⚑ condition "precedent" cited for edge badges builds label strings that the registered edge components never draw | Edge-badge rendering is scoped as explicit new work inside M3, not assumed |
| ui-reality | **⌘K entities need a landing view** — every SearchEntry must carry a `Partial<UrlState>` patch; new entity types (flag, rule, file) each need a permalink target | Each ⌘K-touching milestone (M2, M7) carries its UrlState param + landing view as a named contract |
| ui-reality | **The flow modal has no node/edge click surface** — ReactFlow registers no click handlers; the graph is display-only | Rule cards (M1) open from the step-list chips, not graph nodes; graph interactivity is deferred |
| api-reality | **`onFailure` DLQ target is a `Fn::GetAtt` object, not a text literal** — a grep-shaped scanner cannot extract the DLQ identity | M3's extractor is scoped as an object-aware parser (three shapes), not a regex extension |
| api-reality | **`RedrivePolicy` is factory-materialized once** (`createSqs({dlqToAppend})`) — per-queue DLQ presence is a call-site argument, and a same-named `*Dlq` queue existing nearby proves nothing | Same M3 scoping; the svc-requests notification queues are the ready-made `confirmed-missing` fixtures |

Two verifier verdicts returned retitled results matching the DLQ-linkage and CDC-fault-model
candidates; both dispositions are covered by M3's scoping (edge→queue linkage via the authored
`failure.dlq` name; CDC edges excluded from the SQS fault model).

---

## Material corrections to the plan's factual claims (from grounding)

- **Flag `kind` is NOT derivable from the name.** Product flags exist without any prefix
  (`ACCESS_LEGAL_WEEKLY_HOURS`, `MISSIONS_DEFAULT_SETTING_ON`); kind is determined by the helper
  method at the call site (`can_access?` vs `dev_flag_activated?`). The schema keeps `kind`
  authored, checker-assisted — not inferred.
- **The plan's monolith-auth claim was backwards.** `app/controllers/v3/api/` exists — 140
  files, 249 `before_action`, 531 `authorize`/`can_*` hits. The monolith v3 REST surface is
  large and extractable-adjacent, not thin.
- **The DLQ backfill surface is ~16 edges, not 66.** Of 66 async code edges, 50 are
  intra-monolith Sidekiq hops or raw infra-node hops with no service-level DLQ concept; and the
  two evidence services (svc-punch, svc-requests) are not async-edge *targets* anywhere in the
  dataset — initial backfill lands on svc-events, svc-search (CDC — excluded), svc-websockets,
  svc-intelligence.
- **The rule-divergence enum `web|mobile|tablet` mismatches the flagship rule.** Mobile is a
  non-participant in overnight day-attribution (the phone posts a punch; svc-punch and the
  monolith do the bucketing). The real divergence set for that rule: svc-punch backend, monolith,
  web front, tablet. The platform enum widens to include backend/monolith or becomes free-form.
- **The doc-gen premise "same pattern as the discovered overlay" does not exist.** No diff gate
  runs in CI today; `pnpm discover` never runs there. The M6 gate is genuinely new (and stays
  self-contained). `planning-actions-coverage.md`'s organizing unit (sub-flow UI actions) has
  zero schema representation — only sections of it are derivable; the generator owns marked
  sections and leaves analysis prose alone.

## Refuted candidates (killed by verification)

Five candidates were refuted across the two passes — e.g. "the spec never defines async-edge
discrimination" survived intrinsically but was killed in reality (the `mode` enum exists), and
two reality candidates about schema-linkage gaps were covered by the authored-`dlq`-name design.
Full agent-level detail lives in the session's workflow journals.
