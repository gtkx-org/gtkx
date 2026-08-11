export const meta = {
    name: "gtkx-bug-fix",
    description: "Fix confirmed GTKX findings one at a time on bugfix/v1.0, each with a regression test and a review",
    whenToUse: "After a hunt round confirms findings. args: { findings: [...] } from the hunt workflow's `confirmed` list.",
    phases: [
        { title: "Fix", detail: "one agent per finding, sequential, each committing its own change" },
        { title: "Review", detail: "an independent reader checks the commit against the report" },
        { title: "Remediate", detail: "rework a fix the reviewer rejected, then review it again" },
    ],
};

const WORKTREE = "/home/eugenio/gtkx-bughunt";

const input = typeof args === "string" ? JSON.parse(args) : args || {};
const roundNumber = input.round || 1;
const roundFile = `${WORKTREE}/.bughunt/round-${roundNumber}.json`;
const findings = input.findings || [];

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

THE DEFECT — entry \`confirmed[${finding.recordIndex}]\` of ${roundFile}:

  title:    ${finding.title}
  surface:  ${finding.surface}
  severity: ${finding.severity}

**Read that record first.** It holds the full reproduction, the verbatim observed output, the expected
behavior with its justification, the replay evidence, the minimal reproduction, and an independent
reader's analysis of where the defect lives and what the fix should look like. Do not start from the
three lines above.

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

5. Verify what you touched:
     pnpm vitest run --project e2e <your test file>
     pnpm nx run @gtkx/<package>:test     for every package you changed
     pnpm typecheck
     pnpm nx run @gtkx/<package>:lint     for every package you changed
   If you touched Rust, also \`pnpm nx run @gtkx/native:test\`. If you changed codegen output, run
   \`pnpm codegen\` and re-run typecheck. Every warning is a failure — find its cause and eliminate it,
   never dismiss it as benign or pre-existing. The full pipeline runs once after every fix has landed,
   so keep this pass targeted but do not skip it.

6. Run \`npx jsinspect-plus@latest --threshold 20 <the paths you changed>\` and resolve any duplication
   it reports.

7. Commit to \`bugfix/v1.0\`. One line, at most ten words, no attribution, no co-author trailer.

   **Another agent is working in this same tree on a separate defect in \`packages/codegen\` and
   \`packages/utils/src/source\`.** Its work is uncommitted and is not yours. So:
   - Stage your files by explicit path: \`git add <path> <path>\`. Never \`git add -A\`, never \`git add .\`,
     never \`git commit -a\`.
   - Run \`git status --short\` before committing and confirm every staged path is one you edited.
   - Leave every other modified or untracked file exactly as you found it. Do not revert it, do not
     commit it, do not \`git stash\` it, and do not "clean up" the tree.
   - If a file you need to change is already modified by that other work, do not fight it: make your
     change on top, stage only that file if it is genuinely yours to change, and say so in your summary.
   - If verifying your fix requires touching code outside it, commit that separately first, with its
     own message, before the commit that carries your fix.

If the defect turns out not to be real, or the fix belongs in the documentation rather than the code,
say that instead of forcing a change. Returning \`isFixed: false\` with a clear explanation is a valid
outcome. Never weaken or delete an existing test to make something pass.

This is fix ${index + 1} of ${findings.length}.`;

const reviewPrompt = (finding, fix) => `Review a bug fix that was just committed to GTKX's \`bugfix/v1.0\` branch.

THE ORIGINAL DEFECT — entry \`confirmed[${finding.recordIndex}]\` of ${roundFile}, titled:
  ${finding.title}

Read that record for the reproduction and the expected behavior before you judge the fix.

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

const remediatePrompt = (finding, fix, review, attempt) => `A fix you must now correct was committed to GTKX's \`bugfix/v1.0\` branch and an independent reviewer
rejected it. Attempt ${attempt} of 2.

THE ORIGINAL DEFECT — entry \`confirmed[${finding.recordIndex}]\` of ${roundFile}, titled:
  ${finding.title}

Read that record first for the reproduction and the expected behavior.

THE REJECTED FIX: commit ${fix.commit || "HEAD"}. Read it with \`git show\`.

WHAT THE REVIEWER FOUND WRONG:
${
    finding.remediationRef
        ? `Read \`${finding.remediationRef}\` of ${WORKTREE}/.bughunt/remediation-${roundNumber}.json.\n` +
          `It holds the reviewer's full assessment and its numbered list of specific problems. Work from\n` +
          `that file, not from a summary of it.`
        : `${review.assessment}\n\nSPECIFIC PROBLEMS:\n${(review.problems || []).map((problem, index) => `${index + 1}. ${problem}`).join("\n\n")}`
}

Every problem above was verified against the committed code by someone who did not write it. Treat
them as true unless you can demonstrate otherwise, and say so explicitly if you do.

Correct the fix:
- Address every problem, not the easiest ones. If the reviewer says the fix reaches only a subset of
  the affected cases, widen it to the whole set and add a test for the case it was missing.
- If the reviewer says the fix introduced a regression, that regression matters more than the original
  defect. Remove it.
- If the reviewer says a test locks in partial behavior, replace that test, do not add another beside it.
- If documentation now promises behavior the code does not deliver, correct whichever is wrong.
- Prefer reworking the approach over patching around it. You may revert the original commit and redo it.

Then verify and commit exactly as the original fix instructions required, including staging your files
by explicit path and leaving the other agent's uncommitted \`packages/codegen\` work alone.`;

phase("Fix");
log(`args arrived as ${typeof args}; ${findings.length} confirmed findings to fix`);

if (findings.length === 0) {
    throw new Error(`No findings in args. Received: ${JSON.stringify(args).slice(0, 400)}`);
}

const outcomes = [];

for (let index = 0; index < findings.length; index += 1) {
    const finding = findings[index];
    const label = finding.title ? finding.title.slice(0, 40) : `finding ${index + 1}`;

    let fix = finding.priorFix;
    let review = finding.priorReview;

    if (!fix) {
        fix = await agent(fixPrompt(finding, index), {
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

        review = await agent(reviewPrompt(finding, fix), {
            label: `review:${label}`,
            phase: "Review",
            schema: REVIEW_SCHEMA,
        });
    }

    for (let attempt = 1; attempt <= 2 && review && !review.isSound; attempt += 1) {
        log(`QUESTIONED, remediating (${attempt}/2): ${label}`);

        const redone = await agent(remediatePrompt(finding, fix, review, attempt), {
            label: `remediate:${label}`,
            phase: "Remediate",
            schema: FIX_SCHEMA,
        });

        if (!redone || !redone.isFixed) {
            log(`remediation ${attempt} produced no change: ${label}`);
            break;
        }

        fix = redone;

        review = await agent(reviewPrompt(finding, fix), {
            label: `re-review:${label}`,
            phase: "Review",
            schema: REVIEW_SCHEMA,
        });
    }

    log(`${review && review.isSound ? "sound" : "STILL QUESTIONED"}: ${label}`);
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
