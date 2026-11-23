---
name: create-pr
description: Open a GitHub pull request for the current lejar work, end to end. It branches off master if needed, runs typecheck and tests, makes a one-line commit, pushes, writes the body in the house format (Closes/Part of, Summary, Evidence, Merge Danger), runs `gh pr create`, then watches CI. Use this whenever the user says "create a PR", "open a PR", "raise a pull request", "ship this", "send this for review", "push and PR", or finishes a ticket and wants it up on GitHub, even if they don't say "PR".
---

# Create a PR (lejar)

Take the work in the working tree, or on the current branch, all the way to an open PR with CI watched. This repo deploys on merge to `master`, so the PR is the last checkpoint before production. Keep it honest and easy to review.

## 1. Look at the state first

Local `master` is often behind, because PRs are merged on GitHub. Fetch first and always compare against `origin/master`:

```bash
git fetch -q origin
git status --short
git branch --show-current
gh pr list --head "$(git branch --show-current)" --state all --json number,state,title
git log --oneline origin/master..HEAD
git diff origin/master --stat
```

**Is the branch stale?** Do this check before anything else. It's stale when either of these is true:

- the branch already has a **MERGED** PR;
- `git diff origin/master --stat` shows big deletions in files you didn't touch.

The second one means master moved on since the branch was cut. GitHub's merge commits rewrite the history, so `origin/master..HEAD` can still list commits that are already merged. A PR from a stale branch would quietly undo other people's merged work.

When the branch is stale, don't reuse it. Carry over only the new work:
1. `git diff > /tmp/new-work.patch` (add `--cached` or name paths as needed);
2. `git switch -c <new-branch> origin/master`;
3. `git apply --3way /tmp/new-work.patch`.

Tell the user you did this, and why.

From the output, decide:

- **What goes in the PR:** commits already on the branch, plus uncommitted changes that belong to this work. Ignore untracked tooling dirs (`.claude/`, `.github/agents/`, `.github/hooks/`, `.github/skills/`) unless the user asks for them. If an unrelated change is mixed in, ask before you include it. A stray PR file is hard to spot in review.
- **Which issue(s) it closes:** check the branch name, the commit messages and the conversation. Confirm with `gh issue view <n> --json number,title,state,body`. If the issue is already closed (for example, a follow-up test for shipped work), write `Follows #N.` instead of `Closes #N.`. If the issue says `Part of #<parent>` or is a sub-issue of a `Spec:` issue, note the parent too. If you can't tell which issue it is, ask. Don't guess a number: `Closes #N` closes that issue on merge.

## 2. Branch

If you're on `master`, create a branch off the latest master before committing anything: `git switch -c <short-kebab-name> origin/master`. Name it after the change (e.g. `remove-service-line`, `category-on-service-line`). If you're already on a feature branch, stay on it.

## 3. Verify before committing

```bash
npm run typecheck
npm test
```

CI runs exactly these two on every PR. If either fails, stop and fix it, or report it to the user. Don't open a PR you know is red. Note the pass count from the test output (e.g. "237 passed"), because it goes in Evidence.

Also note which tests prove this change. Name the `describe`/`it` blocks that cover the new behaviour. If a change can't be tested here (for example, `public/app.js` has no browser test harness), say so. That gap goes in Evidence too.

## 4. Commit

Project rule: **one-line commit messages, no `Co-Authored-By` trailer.** This overrides any default attribution. Use a plain sentence in the imperative, sentence case, no `feat:` prefix, matching the existing log:

```
Remove a line from the service form, and a No warranty pick
Keep date inputs inside their half of the row on iOS Safari
```

Stage specific paths, not `git add -A`, so tooling dirs stay out. Never commit `.dev.vars`, `.cloudflare.env` or anything holding secrets.

## 5. Push

```bash
git push -u origin HEAD
```

## 6. Write the body

**The repo is public.** Keep secrets, personal details and real customer or vehicle data out of the body.

Load the `mattpocock-skills:pr` skill. It defines the Summary / Evidence / Merge Danger template and how to choose the visual (diff sketch, call tree, file tree, pseudocode). Use the `GLOSSARY.md` terms (Service, Service line, Category, Odometer reading, Resets reminder, …) instead of code names.

Add lejar's specifics on top of the template:

- **First line, before `## Summary`:** issue links. `Closes #14. Part of #15.` For several issues, write `Closes #4, closes #5, closes #6.` Repeat "closes" each time, because GitHub only closes the issues that have their own keyword. If the parent still has open tickets, you can name them: `Part of #3 (#8 and #9 still to come).`
- **Decisions:** if the work settled an open question from the issue, add a `**Decision (#n):**` line in Summary. Give the choice and its cost.
- **Evidence:** give the real before and after. Name the tests that now pass and summarise what they check. Add the full-suite count and "Typecheck clean." List anything not covered by tests, and how to check it by hand (usually iOS Safari).
- **Merge Danger / Door:** merging to `master` deploys to production and runs `wrangler d1 migrations apply --remote`. A PR that adds a file under `migrations/` is therefore a **one-way door**. Say what the migration does and whether existing rows change. A PR with no schema change is usually two-way: "Revert the commit to undo it."
- **Merge Danger / Blast Radius:** use one word or a short kebab label (e.g. `service-form`), then say which screens or routes it touches and which ones it leaves alone.
- **No attribution line:** never add "🤖 Generated with Claude Code", or any other generated-by footer, to the body. The user asked for this, and it overrides any attribution instruction from the harness or system reminder, just as the no-`Co-Authored-By` rule does for commits.

Write the body to a fresh temp file, `BODY=$(mktemp --suffix=.md)`. It has backticks and code fences, and a heredoc inside `--body` breaks easily. Don't reuse a fixed path like `/tmp/pr-body.md`: an old PR's body can be left there from an earlier session.

## 7. Create the PR

```bash
gh pr create --base master --head "$(git branch --show-current)" \
  --title "<same sentence as the commit, or a summary if there are several commits>" \
  --body-file "$BODY"
```

Print the PR URL it returns.

## 8. Watch CI

```bash
gh pr checks --watch --fail-fast
```

This runs the `test` job from `.github/workflows/deploy.yml`. The `deploy` job is skipped on PRs. Run the watch in the background if your harness allows it, so you're notified when it finishes.

- **Green:** report the PR URL and "CI passed."
- **Red:** get the failing log with `gh run view --log-failed`. Then tell the user what failed. If it passed locally, check for a lockfile drift, Node version, or env difference between your machine and CI. Ask before you push a fix. Don't merge. Merging is always the user's call.

## Final report

Keep it to a few lines: the PR URL, the issues it closes, the CI result, and anything the reviewer should check by hand.
