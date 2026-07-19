# Planning Actions — Dependency Graph Coverage

Cross-reference of all user-initiated actions in `skello-app-front` (vue-app, planning section) against the flows currently modelled in the dependency graph.

<!-- GENERATED:planning-flows BEGIN — run `pnpm docs:gen`, do not edit inside -->
**The dependency graph models 39 flows** — 6 touch the scheduling domain: `assistant-chat` `auto-planning-generation` `workload-plan-consultation` `workload-plan-creation` `shift-replacement-search` `planning-page-load`

_The action-level table below is hand-maintained — sub-flow UI actions have no schema representation. Every ✅ flow id it cites is checked against the dataset by the docs-gen test._
<!-- GENERATED:planning-flows END -->

**Action coverage: ~23 of ~45 meaningful actions** (hand-maintained)

---

## Common (across all views)

| Action | In graph? |
|--------|-----------|
| Publish planning | ✅ `shift-publication` |
| Lock / unlock planning period | ✅ `planning-period-lock` |
| Request unlock (intermediate lock) | ✅ `planning-period-lock` |
| Erase all shifts (bulk delete) | ✅ `shift-bulk-erase` |
| Create from template | ✅ `planning-template` |
| Save planning as template | ✅ `planning-template` |
| Undo / redo | ❌ |
| Deactivate shift alert | ❌ |
| Print planning | ❌ *(UI/export only)* |
| Sort planning | ❌ *(UI only)* |
| Display options | ❌ *(UI only)* |
| Filter by position / team | ❌ *(UI only)* |

---

## Weekly View

| Action | In graph? |
|--------|-----------|
| Create shift | ✅ `shift-creation` |
| Update shift | ✅ `shift-update` |
| Delete shift | ✅ `shift-deletion` |
| Copy week (source → target) | ✅ `week-copy` |
| Drag-and-drop shift (move/reassign) | ❌ *(variant of update)* |
| Quick-select employee reassignment | ❌ *(variant of update)* |
| Create absence | ✅ `absence-creation` |
| Swap shifts between employees | ✅ `shift-swap` |
| Validate day (lock by day) | ❌ |
| Create shift from popular shifts | ❌ |
| Automatic planning (Smart Planner) | ✅ `auto-planning-generation` |
| Optimization side panel | ❌ |
| Request e-signature | ✅ `document-generation-esignature` |
| Shift replacement search | ✅ `shift-replacement-search` |
| Schedule recommendation | ❌ |
| Add task to shift | ❌ |
| Add document to shift | ❌ |
| Add comment to shift | ❌ |

---

## Daily View

| Action | In graph? |
|--------|-----------|
| Create shift | ✅ `shift-creation` |
| Update shift | ✅ `shift-update` |
| Delete shift | ✅ `shift-deletion` |
| Move shift to unassigned | ❌ *(variant of update)* |
| Suggest replacement | ✅ `shift-replacement-search` |
| Add task to shift | ❌ |
| Add document to shift | ❌ |
| Add comment to shift | ❌ |

---

## Positions View

| Action | In graph? |
|--------|-----------|
| Create shift (position-based) | ✅ `shift-creation` |
| Update shift (position-based) | ✅ `shift-update` |
| Create new position (poste) | ❌ |
| Manage absence types per position | ❌ |

---

## Monthly View

| Action | In graph? |
|--------|-----------|
| Create shift | ✅ `shift-creation` |
| Update shift | ✅ `shift-update` |
| Delete shift | ✅ `shift-deletion` |
| Drag-and-drop shift | ❌ *(variant of update)* |
| Publish planning | ✅ `shift-publication` |
| Planning report export | ✅ `planning-report-export` |
| Toggle week counters display | ❌ *(UI only)* |
| Drill into daily breakdown | ❌ *(UI only)* |

---

## Special / Cross-cutting

| Action | In graph? |
|--------|-----------|
| Workload plan consultation | ✅ `workload-plan-consultation` |
| Workload plan creation | ✅ `workload-plan-creation` |
| Leave request approval | ✅ `leave-request-approval` |
| Leave request cancellation | ✅ `leave-request-cancellation` |
| Planning page load (BFF fan-out) | ✅ `planning-page-load` |
| Update shop planning config | ❌ |
| Update user planning config | ❌ |
| Create / edit / delete planning event | ✅ `planning-event-management` |

---

## Gap Summary

Highest-value flows not yet modelled:

| Priority | Action | Notes |
|----------|--------|-------|
| ~~High~~ | ~~Lock / unlock planning period~~ | ✅ `planning-period-lock` |
| ~~High~~ | ~~Create absence~~ | ✅ `absence-creation` |
| ~~Medium~~ | ~~Bulk erase shifts~~ | ✅ `shift-bulk-erase` |
| ~~Medium~~ | ~~Swap shifts between employees~~ | ✅ `shift-swap` |
| ~~Medium~~ | ~~Create / edit / delete planning event~~ | ✅ `planning-event-management` |
| ~~Medium~~ | ~~Create from template / Save as template~~ | ✅ `planning-template` |
| Low | Validate day | Day-level locking within a week |
| Low | Update shop / user planning config | Settings changes |
| Low | Add task / document / comment to shift | Shift sub-item management |
| Low | Optimization side panel | Wraps `auto-planning-generation` |
| Low | Schedule recommendation | AI suggestion on shift creation |
| Low | Request unlock (intermediate lock) | ✅ covered in `planning-period-lock` |
