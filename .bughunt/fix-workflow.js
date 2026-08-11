export const meta = {
    name: "gtkx-bug-fix",
    description: "Fix confirmed GTKX findings one at a time on bugfix/v1.0, each with a regression test and a review",
    whenToUse: "After a hunt round confirms findings. args: { findings: [...] } from the hunt workflow's `confirmed` list.",
    phases: [
        { title: "Fix", detail: "one agent per finding, sequential, each committing its own change" },
        { title: "Review", detail: "an independent reader checks the commit against the report" },
    ],
};

const WORKTREE = "/home/eugenio/gtkx-bughunt";

const findings = (args && args.findings) || [];

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
        assessment: { type: "string", description: "Whether the change fixes the reported defect without breaking anything else." },
        problems: { type: "array", items: { type: "string" }, description: "Concrete defects in the fix itself." },
    },
};

const fixPrompt = (finding, index) => `Fix one confirmed defect in GTKX v1.0.

THE DEFECT:
${JSON.stringify(finding, null, 2)}

You are working directly in ${WORKTREE}, on branch \`bugfix/v1.0\`. It is installed and built. Other fix
agents ran before you and will run after you, one at a time — the tree is yours alone right now, and you
must leave it clean and committed.

Do this, in order:

1. Reproduce the defect against the source, not against the published package. Distil the reporter's
   reproduction into a test under the suite that owns the surface — usually \`packages/e2e/tests/\`,
   sometimes a package's own tests or a Rust test under \`packages/native/\`. Run it and watch it fail:
     pnpm vitest run --project e2e <file>
   A fix without a test that fails before it and passes after it is not finished.

2. Find the real cause. \`likelyLocation\` in the report is a lead from someone who did not fix it — verify
   it before trusting it. Fix the cause, not the symptom, and not the test.

3. Follow the repository's conventions exactly; they are enforced by the linter and CI will reject a
   violation. Read ${WORKTREE}/CLAUDE.md. In particular: no inline exports, the module section order,
   the statement padding rules, boolean and accessor naming, no comments of any kind, no \`!\`
   non-null assertions, no \`as unknown as\`, no \`readonly\`, four-space indent, double quotes.

4. Delete the old code path rather than keeping it alongside the new one. Update every call site,
   test, demo, and example in the same change. No compatibility shims, no deprecation, no aliases.

5. Verify:
     pnpm vitest run --project e2e <your test file>
     pnpm nx run @gtkx/e2e:test
     pnpm typecheck
     pnpm lint
   plus whatever suite owns the code you touched. Every warning is a failure — fix its cause, do not
   dismiss it. If you touched Rust, also run \`pnpm nx run @gtkx/native:test\`.

6. Run \`npx jsinspect-plus@latest --threshold 20 <the paths you changed>\` and resolve any duplication
   it reports.

7. Commit to \`bugfix/v1.0\`. One line, at most ten words, no attribution, no co-author trailer.
   Commit only your own change; if you find the tree dirty from something else, stop and say so.

If the defect turns out not to be real, or the fix belongs in the documentation rather than the code,
say that instead of forcing a change. Returning \`isFixed: false\` with a clear explanation is a valid
outcome. Never weaken or delete an existing test to make something pass.

This is fix ${index + 1} of ${findings.length}.`;

const reviewPrompt = (finding, fix) => `Review a bug fix that was just committed to GTKX's \`bugfix/v1.0\` branch.

THE ORIGINAL DEFECT:
${JSON.stringify(finding, null, 2)}

WHAT THE FIXER REPORTS:
${JSON.stringify(fix, null, 2)}

Read the actual commit in ${WORKTREE} (\`git show ${fix.commit || "HEAD"}\`), not just the summary.

Answer, from the code:
- Does the change fix the reported defect, or does it only hide the symptom the test checks?
- Does the regression test genuinely fail without the change? Check out the parent of the fix commit
  for that file if you need to, but restore the tree exactly as you found it.
- Does it break any other caller? Search for every use of what changed.
- Does it violate the conventions in ${WORKTREE}/CLAUDE.md — inline exports, section order, comments,
  \`!\` assertions, \`as unknown as\`, \`readonly\`, naming rules?
- Did it leave a legacy path, a shim, or a dead branch alive?
- Is there a narrower or more correct fix?

Do not modify anything. Report only.`;

phase("Fix");
log(`${findings.length} confirmed findings to fix`);

const outcomes = [];

for (let index = 0; index < findings.length; index += 1) {
    const finding = findings[index];
    const label = finding.title ? finding.title.slice(0, 40) : `finding ${index + 1}`;

    const fix = await agent(fixPrompt(finding, index), {
        label: `fix:${label}`,
        phase: "Fix",
        schema: FIX_SCHEMA,
    });

    if (!fix) {
        log(`fix agent died on: ${label}`);
        outcomes.push({ finding, fix: null, review: null });
        continue;
    }

    if (!fix.isFixed) {
        log(`not fixed: ${label} — ${fix.summary}`);
        outcomes.push({ finding, fix, review: null });
        continue;
    }

    const review = await agent(reviewPrompt(finding, fix), {
        label: `review:${label}`,
        phase: "Review",
        schema: REVIEW_SCHEMA,
    });

    log(`${review && review.isSound ? "sound" : "QUESTIONED"}: ${label}`);
    outcomes.push({ finding, fix, review });
}

return {
    fixed: outcomes.filter((entry) => entry.fix && entry.fix.isFixed).map((entry) => ({
        title: entry.finding.title,
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
        title: entry.finding.title,
        why: entry.fix ? entry.fix.summary : "fix agent died",
    })),
};
