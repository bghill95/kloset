---
description: Verify, commit, push, and open a PR for the current work
---

1. Run `npm test && npm run typecheck && npm run test:e2e`. If anything fails,
   stop and report — do not commit broken work.
2. `git status` and `git diff` to review what changed. Stage everything that
   belongs to the current task (never `.env.local`).
3. Commit with a conventional message (feat:/fix:/test:/docs:/chore:)
   describing the change.
4. If on `main`, create a branch named for the change first.
5. Push with `git push -u origin HEAD`.
6. Open a PR with `gh pr create --fill` and report the URL.
