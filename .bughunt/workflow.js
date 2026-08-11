export const meta = {
    name: "gtkx-bug-hunt",
    description: "Run an AI userbase round against GTKX v1.0: persona hunters, then adversarial verification",
    whenToUse: "One round of continuous bug hunting on the bugfix/v1.0 worktree. args: { round, personas }",
    phases: [
        { title: "Hunt", detail: "one persona agent per surface, each in its own scratch app" },
        { title: "Replay", detail: "re-run each reproduction from a clean shell, 10 times" },
        { title: "Attribute", detail: "decide whether GTKX is at fault and locate the defect" },
    ],
};

const WORKTREE = "/home/eugenio/gtkx-bughunt";
const PLAYGROUND = "/home/eugenio/gtkx-playground";
const MAX_VERIFIED_PER_PERSONA = 6;

const DEFAULT_PERSONAS = ["cli", "marshal", "subclass", "testkit", "hotreload", "higapp", "lifecycle"];

const round = (args && args.round) || 1;
const personas = (args && args.personas) || DEFAULT_PERSONAS;

const FINDINGS_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["covered", "findings"],
    properties: {
        covered: {
            type: "string",
            description: "What you actually exercised, and what you could not reach and why.",
        },
        findings: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "surface", "severity", "oracle", "repro", "observed", "expected", "reproRate", "scratchDir"],
                properties: {
                    title: { type: "string", description: "One line naming the defect, not the symptom trail." },
                    surface: { type: "string", description: "Package, command, or API at fault." },
                    severity: { type: "string", enum: ["crash", "wrong-result", "hang", "leak", "dx"] },
                    oracle: { type: "string", description: "Which numbered oracle from brief.md fired." },
                    repro: { type: "string", description: "Self-contained commands or file contents plus how to run them." },
                    observed: { type: "string", description: "Verbatim output, including any critical or stack trace." },
                    expected: { type: "string", description: "What should have happened, and the doc, GTK API, or law that says so." },
                    reproRate: { type: "string", description: 'e.g. "10/10" or "3/10".' },
                    scratchDir: { type: "string", description: "Absolute path where the reproduction was left." },
                },
            },
        },
    },
};

const REPLAY_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["doesReproduce", "reproRate", "evidence"],
    properties: {
        doesReproduce: { type: "boolean" },
        reproRate: { type: "string" },
        evidence: { type: "string", description: "Verbatim output from your own replay, or why it failed to replay." },
        minimalRepro: { type: "string", description: "The smallest reproduction you could reduce it to, if any." },
    },
};

const ATTRIBUTION_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["isGtkxAtFault", "reasoning"],
    properties: {
        isGtkxAtFault: { type: "boolean" },
        reasoning: { type: "string", description: "Why GTKX is or is not at fault. Cite the GTK4 docs or the GTKX source." },
        duplicateOf: { type: "string", description: "Ledger id if this duplicates a known finding." },
        likelyLocation: { type: "string", description: "file:line or file and function in the worktree where the defect lives." },
        suggestedFix: { type: "string", description: "One paragraph on the shape of the correct fix." },
    },
};

const huntPrompt = (slug) => `You are the \`${slug}\` bug hunter for GTKX v1.0, round ${round}.

Read these first, in order:
1. ${WORKTREE}/.bughunt/brief.md — the rules, the environment, and the oracles that count as proof.
2. The \`${slug}\` section of ${WORKTREE}/.bughunt/personas.md — your mission. Work only that surface.
3. ${WORKTREE}/.bughunt/findings.jsonl — everything already known. Do not re-report any of it. Entries
   marked \`believed-fixed\` are worth re-verifying; if one still reproduces on 1.0.0, that IS a finding.

Set up your scratch area:
- Yours is ${PLAYGROUND}/${slug}-r${round}. Create it and own it.
- Unless your mission is scaffolding itself, copy the prepared app instead of scaffolding a new one:
    cp -a ${PLAYGROUND}/bughunt-template ${PLAYGROUND}/${slug}-r${round}
  It is an npm project with @gtkx/*@1.0.0 installed from the public npm registry, Gtk-4.0 + Adw-1 +
  GtkSource-5 + WebKit-6.0 bound, and a warm codegen store. It already typechecks, builds, tests and runs,
  so any failure you see after copying it is yours to explain.
- Run anything that opens a window through ${WORKTREE}/.bughunt/run-headless.sh <seconds> <command> [args...].
  It exits 124 when the app was still alive at the deadline, which is success for a GUI app.
- Measure process leaks with ${WORKTREE}/.bughunt/count-strays.sh, before and after.

Hard rules:
- Write nothing inside ${WORKTREE}. Read it freely to explain what you found; never modify it.
- Write nothing inside ${PLAYGROUND}/bughunt-template. Copy it.
- Do not fix anything. Report only.
- Every finding needs a reproduction another agent can replay from a clean shell. No repro, no finding.
- Prefer depth over breadth: a handful of probes taken all the way to a proven defect beats a survey.
- Say what you could not reach. An empty result from a thorough pass is a useful result.`;

const replayPrompt = (finding, slug) => `Replay a bug report against GTKX v1.0 and try to make it fail to reproduce.

You are not the reporter. Treat the report as a claim to be tested, not a fact.

REPORT (from the \`${slug}\` hunter):
${JSON.stringify(finding, null, 2)}

Do this:
1. Work in a fresh directory of your own: ${PLAYGROUND}/replay-${slug}-r${round}-<n>. Copy
   ${PLAYGROUND}/bughunt-template if you need an app. Do not reuse the reporter's scratch directory —
   the whole point is to check the repro is self-contained.
2. Follow the reproduction exactly as written. If a step is missing or ambiguous, that alone is a
   reason to report doesReproduce=false: the repro is not replayable.
3. Run it 10 times. Report the true rate. An intermittent failure still reproduces; say so.
4. Read ${WORKTREE}/.bughunt/brief.md for the environment (headless runner, required env vars) so you do
   not mistake a setup mistake for a defect.

Return doesReproduce=false unless you personally saw the failure. Do not take the report's word for it.`;

const attributionPrompt = (finding, slug) => `Judge whether GTKX is at fault for a reported defect. Your default is that it is not.

REPORT (from the \`${slug}\` hunter):
${JSON.stringify(finding, null, 2)}

Rule it out if any of these hold, and say which:
- The GTK4 / Adwaita / GLib C API documentation says this is the correct behavior. GTKX faithfully
  exposing a GTK limitation is not a GTKX defect.
- The reproduction misuses the API in a way the GTKX documentation warns about.
- It duplicates an entry in ${WORKTREE}/.bughunt/findings.jsonl. Name the id.
- It is an artifact of this machine: a missing system package, the container, the headless compositor,
  or a stale codegen store. Reproduce the same operation a different way to check.
- It is a missing feature rather than a broken one.

If it survives all of that, confirm it and locate it. Read the source under ${WORKTREE}/packages/ and
name the file and function where the defect lives, plus one paragraph on the correct fix. Base that on
reading the code, not on guessing from the symptom.

Write nothing inside ${WORKTREE}.`;

phase("Hunt");
log(`Round ${round}: ${personas.length} personas — ${personas.join(", ")}`);

const results = await pipeline(
    personas,
    (slug) => agent(huntPrompt(slug), { label: `hunt:${slug}`, phase: "Hunt", schema: FINDINGS_SCHEMA }),
    (report, slug) => {
        if (!report || !report.findings || report.findings.length === 0) {
            return { slug, covered: report ? report.covered : "agent returned nothing", verified: [] };
        }

        const all = report.findings;
        const taken = all.slice(0, MAX_VERIFIED_PER_PERSONA);

        if (all.length > taken.length) {
            log(`${slug}: reported ${all.length} findings, verifying the first ${taken.length}; ${all.length - taken.length} not verified this round`);
        }

        return parallel(
            taken.map((finding) => () =>
                parallel([
                    () => agent(replayPrompt(finding, slug), { label: `replay:${slug}`, phase: "Replay", schema: REPLAY_SCHEMA }),
                    () => agent(attributionPrompt(finding, slug), { label: `attribute:${slug}`, phase: "Attribute", schema: ATTRIBUTION_SCHEMA }),
                ]).then(([replay, attribution]) => ({ finding, slug, replay, attribution })),
            ),
        ).then((verified) => ({ slug, covered: report.covered, verified: verified.filter(Boolean) }));
    },
);

const rounds = results.filter(Boolean);
const everyVerdict = rounds.flatMap((entry) => entry.verified || []);

const confirmed = everyVerdict.filter(
    (entry) => entry.replay && entry.replay.doesReproduce && entry.attribution && entry.attribution.isGtkxAtFault,
);

const rejected = everyVerdict.filter((entry) => !confirmed.includes(entry));

log(`Round ${round}: ${confirmed.length} confirmed, ${rejected.length} rejected, from ${everyVerdict.length} reports`);

return {
    round,
    personas,
    coverage: rounds.map((entry) => ({ persona: entry.slug, covered: entry.covered })),
    confirmed: confirmed.map((entry) => ({
        persona: entry.slug,
        ...entry.finding,
        reproRateOnReplay: entry.replay.reproRate,
        replayEvidence: entry.replay.evidence,
        minimalRepro: entry.replay.minimalRepro,
        reasoning: entry.attribution.reasoning,
        likelyLocation: entry.attribution.likelyLocation,
        suggestedFix: entry.attribution.suggestedFix,
    })),
    rejected: rejected.map((entry) => ({
        persona: entry.slug,
        title: entry.finding.title,
        didReplay: entry.replay ? entry.replay.doesReproduce : null,
        isGtkxAtFault: entry.attribution ? entry.attribution.isGtkxAtFault : null,
        why: entry.attribution ? entry.attribution.reasoning : "verification agent failed",
        duplicateOf: entry.attribution ? entry.attribution.duplicateOf : undefined,
    })),
};
