export const meta = {
    name: "gtkx-bug-fix-parallel",
    description: "Fix confirmed GTKX findings in parallel, one worktree per package group, reviewed and remediated",
    whenToUse:
        "After .bughunt/prepare-groups.sh has created the group worktrees. args: { groups: [{ name, worktree, findings: [ids] }] }",
    phases: [
        { title: "Fix", detail: "groups run in parallel; findings within a group run one at a time" },
        { title: "Review", detail: "each fix is reviewed while the next fix in its group proceeds" },
        { title: "Remediate", detail: "rework a fix the reviewer rejected, then review it again" },
    ],
};

const LEDGER = "/home/eugenio/gtkx/.bughunt/findings.jsonl";

const input = typeof args === "string" ? JSON.parse(args) : args || {};
const groups = input.groups || [];

const FIX_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["isFixed", "summary"],
    properties: {
        isFixed: { type: "boolean", description: "Whether a fix was committed." },
        summary: { type: "string", description: "What changed and why, or why no fix was made." },
        commit: { type: "string", description: "The commit sha, if one was made." },
        rootCause: { type: "string", description: "The actual cause, in one paragraph." },
        regressionTest: { type: "string", description: "Path of the test that now covers this." },
        filesTouched: { type: "array", items: { type: "string" } },
        verification: { type: "string", description: "The exact commands run to prove the fix, and their results." },
    },
};

const REVIEW_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["isSound", "assessment"],
    properties: {
        isSound: { type: "boolean" },
        assessment: { type: "string", description: "Whether the change fixes the defect without breaking anything else." },
        problems: { type: "array", items: { type: "string" }, description: "Concrete defects in the fix itself." },
    },
};

const workspaceRules = (group) => `You are working in **${group.worktree}**, on branch \`fixgrp/${group.name}\`.

This is your group's own git worktree. Six other groups are fixing other defects in their own worktrees
at the same time, and every branch is merged back into \`bugfix/v1.0\` afterwards. That makes two rules
absolute:

- **Stay inside ${group.worktree}.** Never read or write \`/home/eugenio/gtkx\` or any other
  \`gtkx-fix-*\` directory. Run every command with that worktree as the working directory.
- **Only touch what your group owns: ${group.owns}.** Editing a file another group owns produces a merge
  conflict that costs more than your fix saves. If your fix genuinely requires a change outside those
  paths, make the smallest possible change there and say so explicitly in your summary so the merge
  step knows to expect it.

The worktree is installed and built. Commit to \`fixgrp/${group.name}\`, staging your files by explicit
path — never \`git add -A\`.`;

const fixPrompt = (group, id, index) => `Fix one confirmed defect in GTKX v1.0.

THE DEFECT: ledger entry \`${id}\`. Read it in ${LEDGER} — one JSON object per line, find the one whose
\`id\` is "${id}". Its \`detail\` field names the round file under /home/eugenio/gtkx/.bughunt/
holding the full reproduction, the verbatim observed output, the expected behavior with its
justification, the replay evidence and an independent reader's analysis of where the defect lives.
Read that record before anything else. Those two files are the only things you may read outside your
worktree, and you may not write to them.

${workspaceRules(group)}

Do this, in order:

1. Reproduce the defect against the source. Distil the reproduction into a test under the suite that
   owns the surface, run it, and watch it fail. A fix without a test that fails before it and passes
   after it is not finished.

2. Find the real cause. The record's \`likelyLocation\` is a lead from someone who did not fix it —
   verify it before trusting it. Fix the cause, not the symptom, and not the test.

3. Follow the repository's conventions exactly; CI rejects a violation. Read the worktree's CLAUDE.md.
   No inline exports, the module section order, statement padding, boolean and accessor naming, no
   comments of any kind, no \`!\` non-null assertions, no \`as unknown as\`, no \`readonly\`, four-space
   indent, double quotes.

4. Delete the old code path rather than keeping it beside the new one. Update every call site, test,
   demo and example in the same change. No shims, no deprecation, no aliases.

5. Verify what you touched, and only what you touched:
     pnpm vitest run --project e2e <your test file>
     pnpm nx run @gtkx/<package>:test     for every package you changed
     pnpm nx run @gtkx/<package>:lint     for every package you changed
     pnpm typecheck
   Add \`pnpm nx run @gtkx/native:test\` only if you changed Rust. **Do not run \`pnpm build\`,
   \`pnpm lint\`, \`pnpm test\`, or the asan/miri targets** — the full pipeline runs once after every
   group has merged, and running it per fix was measured as the single largest cost in the previous
   batch. Every warning is still a failure: find its cause and eliminate it.

6. Commit. One line, at most ten words, no attribution, no co-author trailer.

If the defect turns out not to be real, or already fixed on this branch, or the fix belongs in the
documentation rather than the code, say so and return \`isFixed: false\` rather than forcing a change.
Never weaken or delete an existing test to make something pass; if an existing test blocks your fix,
that test is either right or it is a second defect worth reporting.

This is fix ${index + 1} of ${group.findings.length} in group \`${group.name}\`.`;

const reviewPrompt = (group, id, fix) => `Review a bug fix just committed to branch \`fixgrp/${group.name}\`.

THE ORIGINAL DEFECT: ledger entry \`${id}\` in ${LEDGER}, and the round file its \`detail\` field names.
Read both for the reproduction and the expected behavior before judging.

WHAT THE FIXER REPORTS:
${JSON.stringify(fix, null, 2)}

Read the actual commit in ${group.worktree} (\`git show ${fix.commit || "HEAD"}\`), not just the summary.
Work only inside that worktree; other groups are committing to their own worktrees concurrently.

Answer, from the code:
- Does the change fix the reported defect, or only hide the symptom the test checks?
- Does the regression test genuinely fail without the change? Verify it rather than assuming.
- Does it break any other caller? Search for every use of what changed.
- Did it delete or weaken an existing test instead of fixing the defect? Say so plainly if it did.
- Did it edit files outside \`${group.owns}\`? Those become merge conflicts, so name them.
- Does it violate the conventions in the worktree's CLAUDE.md?
- Did it leave a legacy path, a shim, or a dead branch alive?

Do not modify anything. Report only.`;

const remediatePrompt = (group, id, fix, review, attempt) => `A fix you must now correct was committed to \`fixgrp/${group.name}\` and an independent reviewer
rejected it. Attempt ${attempt} of 2.

THE ORIGINAL DEFECT: ledger entry \`${id}\` in ${LEDGER}, plus the round file its \`detail\` names. Read both.

THE REJECTED FIX: commit ${fix.commit || "HEAD"}. Read it with \`git show\`.

WHAT THE REVIEWER FOUND WRONG:
${review.assessment}

SPECIFIC PROBLEMS:
${(review.problems || []).map((problem, index) => `${index + 1}. ${problem}`).join("\n\n")}

Every problem was verified against the committed code by someone who did not write it. Treat them as
true unless you can demonstrate otherwise, and say so explicitly if you do.

Correct the fix: address every problem, not the easiest ones; widen a fix that reaches only a subset of
the affected cases and add a test for the case it missed; remove any regression it introduced, which
matters more than the original defect; replace a test that locks in partial behavior rather than adding
one beside it. Prefer reworking the approach over patching around it — you may revert and redo.

${workspaceRules(group)}

Verify and commit exactly as the original fix instructions required, with the same narrow verification.`;

const runGroup = async (group) => {
    const landed = [];
    const outcomes = [];

    for (let index = 0; index < group.findings.length; index += 1) {
        const id = group.findings[index];

        const fix = await agent(fixPrompt(group, id, index), {
            label: `${group.name}:fix:${id}`,
            phase: "Fix",
            schema: FIX_SCHEMA,
        });

        if (!fix) {
            log(`${group.name}: fix agent died on ${id}`);
            outcomes.push({ group: group.name, id, fix: null, review: null });
            continue;
        }

        if (!fix.isFixed) {
            log(`${group.name}: ${id} not fixed — ${fix.summary}`);
            outcomes.push({ group: group.name, id, fix, review: null });
            continue;
        }

        landed.push({
            id,
            fix,
            reviewPromise: agent(reviewPrompt(group, id, fix), {
                label: `${group.name}:review:${id}`,
                phase: "Review",
                schema: REVIEW_SCHEMA,
            }),
        });
    }

    for (const entry of landed) {
        let fix = entry.fix;
        let review = await entry.reviewPromise;

        for (let attempt = 1; attempt <= 2 && requiresRework(review); attempt += 1) {
            log(`${group.name}: ${entry.id} questioned, remediating (${attempt}/2)`);

            const redone = await agent(remediatePrompt(group, entry.id, fix, review, attempt), {
                label: `${group.name}:remediate:${entry.id}`,
                phase: "Remediate",
                schema: FIX_SCHEMA,
            });

            if (!redone || !redone.isFixed) {
                log(`${group.name}: remediation ${attempt} produced no change for ${entry.id}`);
                break;
            }

            fix = redone;

            review = await agent(reviewPrompt(group, entry.id, fix), {
                label: `${group.name}:re-review:${entry.id}`,
                phase: "Review",
                schema: REVIEW_SCHEMA,
            });
        }

        outcomes.push({ group: group.name, id: entry.id, fix, review });
    }

    log(`${group.name}: finished ${outcomes.length} findings`);

    return outcomes;
};

const requiresRework = (verdict) =>
    Boolean(verdict) && (!verdict.isSound || (verdict.problems || []).length > 0);

phase("Fix");
log(`${groups.length} groups in parallel, ${groups.reduce((total, group) => total + group.findings.length, 0)} findings`);

if (groups.length === 0) {
    throw new Error(`No groups in args. Received: ${JSON.stringify(args).slice(0, 400)}`);
}

const perGroup = await parallel(groups.map((group) => () => runGroup(group)));
const outcomes = perGroup.filter(Boolean).flat();

return {
    branches: groups.map((group) => `fixgrp/${group.name}`),
    fixed: outcomes.filter((entry) => entry.fix && entry.fix.isFixed).map((entry) => ({
        group: entry.group,
        id: entry.id,
        commit: entry.fix.commit,
        rootCause: entry.fix.rootCause,
        regressionTest: entry.fix.regressionTest,
        filesTouched: entry.fix.filesTouched,
        verification: entry.fix.verification,
        isReviewSound: entry.review ? entry.review.isSound : null,
        reviewAssessment: entry.review ? entry.review.assessment : null,
        reviewProblems: entry.review ? entry.review.problems : null,
    })),
    unfixed: outcomes.filter((entry) => !entry.fix || !entry.fix.isFixed).map((entry) => ({
        group: entry.group,
        id: entry.id,
        why: entry.fix ? entry.fix.summary : "fix agent died",
    })),
};
