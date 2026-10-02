# Lessons — session patterns worth keeping

## Tooling (this environment)

- **Workflow tool `args` arrive JSON-stringified** at the script runtime even
  when passed as an object — embed per-run data in the script body (the
  skello-beta-blueprint skill's own guidance, confirmed twice).
- **Multi-file `grep` through the rtk hook can silently return zero matches**
  (mis-tokenized file args) and downstream pipes can kill it (broken pipe).
  For multi-file sweeps use `rtk proxy grep` on a single target, or Python.
- **`git push -u` can lose its upstream flag through the rtk hook** — after
  the first push of a branch, verify `git rev-parse --abbrev-ref @{u}` and
  set `git branch --set-upstream-to=…` when missing (the global convention
  already mandates the verification).
- **Never `git checkout <file>` to revert a demo mutation on a file carrying
  uncommitted work** — it wipes the uncommitted edits too. Mutate and restore
  with targeted string swaps (python replace), or stage the real work first.

## Dataset doctrine (proven this session, keep applying)

- **Verify a literal exists in source BEFORE authoring a ref to it** (flags,
  gates, DLQs). Where it doesn't verify, the honest move is a different
  shape — waiver, tokenType-only, or prose — never a fabricated ref.
- **Every checker ships with a negative control**: fabricate one wrong value,
  watch the section go red with an actionable remediation in the finding,
  restore. A checker that never went red is unproven.
- **Report sections print the fix**: the re-stamp hash, the real DLQ/authorizer
  candidates — findings double as authoring aids.
- **Absence must be representable** (`dlqAbsent`, `authAbsent`) or genuine
  gaps force fabrication or permanent red.

## Product Areas phase (2026-10-01)

- **Never write history (or any side effect) inside a React setState updater** — StrictMode
  runs updaters twice in dev, so `pushState` there doubles every entry and Back looks broken.
  Compute the next state from a ref, write history once, then `setState`.
- **Whole-repo globs count vendored trees** — Python `site-packages`/`.venv`/`__pycache__`
  inflated one service to 40k "files"; count source extensions only and skip env dirs.
- **`discover:apply` re-stamps everything** — on fresh checkouts it re-dates every stamp and
  drops drifted ones; when a PR only needs one overlay key, merge that key into the committed
  overlay and report the drift separately.
- **Repo-level evidence can't be attributed to a partial owner** — an area claiming part of a
  shared host must not inherit the host's externals; attribute only wholly-claimed repos.

## Verified Paths phase (2026-10-01)

- **Restore a negative control with the reverse swap, never `git checkout --`** — checkout also
  reverts every uncommitted edit in that file; swap the fabricated string back (or restore a
  backup copy) and confirm the real edits are still there.
- **A ground-truth fixture beats a hand-written fixture** — the Rails parser passed its 7 DSL
  cases and still missed 552/795 router triples (`%i[]`, multi-line options, `if` blocks,
  canonical actions in member scopes); only the `rails routes --expanded` dump exposed them.
- **A substring "reference" check over-credits** — `content.includes('Shift')` passed because
  `V3::Shifts::DestroyService` contains it; word-bounded, comment-stripped evidence or a call
  graph is the minimum for a ✓.
- **Barrel imports need the graph's import edges plus a name match** — a barrel re-exports
  every client, so reachability alone credits all of them; require the caller to name the callee.
- **A skipped pin must leave nothing readable** — a leftover worktree under `.pinned/` is read
  as if pinned; remove it on failure and refuse to grade any repo without a pinned head.
- **A hidden browser pane renders React Flow nodes but no edges** — verify edge badges and SVG
  views with `react-dom/server` render tests instead of the pane.
- **zsh reads `$VAR:c…` as a modifier** — write `"${SHA}:config/routes.rb"` with braces.
- **Plan code is not exempt from the code rules** — plan snippets carried `as` casts; check
  every transcribed block against the rules before committing it.

## Resource Impact phase (2026-10-02)

- **A literal match is a reference, not a direction** — "the name appears in another repo" fired on Rails
  `transaction`, locale prose and every consumer's event source; producers need an identifier-shaped
  string literal and must exclude consumers and same-named sibling owners.
- **First-seen wins is order-dependent** — any BFS that keeps the first effect per node must rank
  effects and settle each hop before spreading, or the answer depends on array order.
- **Transitive "fails" through a hub over-claims** — a caller loses only its calls to the failing node;
  beyond hop 1 the map can say "may fail", and flows break only at steps calling the origin.
- **Static configs hide names behind factories, constants and locals** — check `createSqs({ name })`,
  `\${sls:stage}` escapes and HCL `local.project` before concluding a resource is absent, and verify
  constants are names (svc-pos `QUEUE_NAME` were logical ids).
- **A derived surface must refuse to regenerate from missing inputs** — a stale graph silently
  produced zero readers ("safe to change"); make the gap a finding and block the write.
