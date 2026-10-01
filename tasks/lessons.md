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
