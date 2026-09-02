# Prompt for the next session

*Copy everything below the line into a fresh Claude Code session opened on
this repository. It is written for a smaller model executing Phase 0.1–0.2.
For a larger model doing Phase 0.3 onward, swap the "Your task" section for
the one at the bottom.*

---

You are working in `kingdom-sim`, a browser game (Vite + Phaser, plain JS
ES modules, Node 22). A medieval realm simulator: villagers are named
agents, buildings' HP is their output, raiders sack rather than raze, a
warlord camp on the map masses waves, forests and veins deplete, and a
ladder of Great Works is the endgame. It has been built across nine working
sessions with heavy simulation-driven tuning. Two human reigns have won it.

Read these three files first, in this order, before touching any code:

1. `docs/REVIEW-SESSION-10.md` — the current review: what works, the
   verified defects (§2a sim, §2b UI), and the plan.
2. `docs/PLAN-DEFECT-FIXES.md` — your playbook. It has the exact code,
   test, sweep, and commit message for every task.
3. `docs/PLAN-PHASES.md` — the wider plan, so you know what NOT to do.

Skim `docs/DECISIONS.md` Session 9 (top of the file) for the voice the
codebase uses in comments and chronicle lines. Match it.

## Your task

Execute `docs/PLAN-DEFECT-FIXES.md` from Task 0 through Task G, in order,
one commit per task, on a branch named `phase-0/defect-fixes`. Rules the
playbook states and you must keep:

- Before every commit: `npm test && node model/polish-unit-checks.mjs && npm run build`
  all green. If a test you did not write fails, stop and report; never edit
  it to pass.
- Never delete, skip, or weaken an existing check. Never change a number in
  `src/config.js` except `RAID.firstAfter: 400` in Task S4.
- Line numbers in the playbook are from `6313a25`; `grep` for the function
  name before editing. If the code you find does not match the playbook's
  "Current code" block in intent, stop and report the mismatch rather than
  guessing.
- Do not refactor anything a task does not name. Do not touch `sim2/`.
- Record the four-seed sweep (`for seed in 42 7 99 123; do node model/simulate.mjs 25 $seed | tail -1; done`)
  before Task S1 and after every S-task, and paste the lines into the commit
  body as the playbook says.
- Task G (golden hashes) is last, after all S-tasks.

When all tasks are committed, run the "Final gate for the whole batch"
section of the playbook, add the Campaign 15 entry to `docs/SIMULATIONS.md`,
and report: the list of commits, the before/after sweep lines, and anything
you stopped on.

Do not open a pull request unless asked. Do not push to `main`.

---

## Alternative "Your task" for a larger model (Phase 0.3 onward)

Phase 0.1–0.2 are done on `phase-0/defect-fixes` (verify with `git log`
and `npm test`). Execute Phase 0.3 and 0.4 from `docs/PLAN-PHASES.md`:
create `docs/STATUS.md`, consolidate the sediment in `OPEN-QUESTIONS.md`,
write the missing CHANGELOG Sessions 9 and 10, fix the stale headers listed,
archive the three transcripts, label `sim2/` retired, and do the hygiene
list. Then start Phase 1.1 (heroes of the realm) only if Phase 0 is fully
green and `STATUS.md` exists. Read `docs/REVIEW-SESSION-10.md` §3 before
Phase 1 so the legibility work answers the findings it names.
