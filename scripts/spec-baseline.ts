import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Status = "green" | "red";
type Baseline = Record<string, Status>;
type VitestAssertion = { fullName?: string; title?: string; status?: string };
type VitestSuite = { name?: string; assertionResults?: VitestAssertion[] };
type VitestReport = { testResults?: VitestSuite[] };

const PROJECT = "animated";
const BASELINE_PATH = join(import.meta.dirname, "..", "packages", "animated", "tests", "baseline.json");
const SKIP_STATUSES = new Set(["pending", "skipped", "todo"]);
const { observed, skipped } = collect(runSuite());

function runSuite(): VitestReport {
    const root = join(import.meta.dirname, "..");
    const reportPath = join(tmpdir(), `gtkx-spec-report-${String(process.pid)}.json`);
    const args = ["vitest", "run", "--project", PROJECT, "--reporter=json", `--outputFile=${reportPath}`];

    try {
        execFileSync(resolveExecutable("npx"), args, {
            cwd: root,
            encoding: "utf8",
            stdio: "ignore",
            maxBuffer: 64 * 1024 * 1024,
        });
    } catch {
        if (!existsSync(reportPath)) {
            throw new Error("vitest produced no JSON report");
        }
    }

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as VitestReport;
    rmSync(reportPath, { force: true });

    return report;
}

function allAssertions(report: VitestReport): VitestAssertion[] {
    return (report.testResults ?? []).flatMap((suite) => suite.assertionResults ?? []);
}

function getStatus(status: string | undefined): Status {
    return status === "passed" ? "green" : "red";
}

function recordAssertion(assertion: VitestAssertion, observed: Baseline, skipped: string[]): void {
    const name = assertion.fullName ?? assertion.title;

    if (!name) {
        return;
    }

    if (SKIP_STATUSES.has(assertion.status ?? "")) {
        skipped.push(name);

        return;
    }

    observed[name] = getStatus(assertion.status);
}

function collect(report: VitestReport): { observed: Baseline; skipped: string[] } {
    const observed: Baseline = {};
    const skipped: string[] = [];

    for (const assertion of allAssertions(report)) {
        recordAssertion(assertion, observed, skipped);
    }

    return { observed, skipped };
}

const readBaseline = (): Baseline =>
    existsSync(BASELINE_PATH) ? (JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline) : {};

const record = (observed: Baseline): void => {
    const sorted = Object.fromEntries(Object.entries(observed).toSorted(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE_PATH, `${JSON.stringify(sorted, null, 4)}\n`);
    const red = Object.values(sorted).filter((status) => status === "red").length;
    const total = Object.keys(sorted).length;
    process.stdout.write(`Recorded ${String(total)} specs (${String(red)} red) to ${BASELINE_PATH}\n`);
};

const collectFailures = (observed: Baseline, skipped: string[], baseline: Baseline): string[] => {
    const removed = Object.keys(baseline).filter((name) => !Object.hasOwn(observed, name));

    const regressed = Object.entries(observed).filter(
        ([name, status]) => baseline[name] === "green" && status === "red",
    );

    const failures: string[] = Array.from(removed, (name) => `removed spec: ${name}`);

    for (const name of skipped) {
        failures.push(`skipped spec: ${name}`);
    }

    for (const [name] of regressed) {
        failures.push(`regressed green to red: ${name}`);
    }

    return failures;
};

const reportFixed = (observed: Baseline, baseline: Baseline): number => {
    const fixed = Object.entries(observed).filter(([name, status]) => baseline[name] === "red" && status === "green");

    for (const [name] of fixed) {
        process.stdout.write(`fixed: ${name}\n`);
    }

    return fixed.length;
};

const reportFailures = (failures: string[]): void => {
    for (const failure of failures) {
        process.stderr.write(`${failure}\n`);
    }

    process.stderr.write(
        "\nThe spec baseline is frozen. Specs may only move red to green.\n" +
        "Deleting, skipping, or weakening a spec is not a valid way to make the suite pass.\n" +
        "After implementing a behavior, re-record with: pnpm spec:record\n",
    );

    process.exitCode = 1;
};

const reportBaselineHolds = (observed: Baseline, fixedCount: number): void => {
    const total = Object.keys(observed).length;

    process.stdout.write(
        `Baseline holds: ${String(total)} specs, ${String(fixedCount)} newly green, none removed or skipped.\n`,
    );
};

const check = (observed: Baseline, skipped: string[]): void => {
    const baseline = readBaseline();
    const failures = collectFailures(observed, skipped, baseline);
    const fixedCount = reportFixed(observed, baseline);

    if (failures.length > 0) {
        reportFailures(failures);
    } else {
        reportBaselineHolds(observed, fixedCount);
    }
};

if (process.argv.includes("--record")) {
    record(observed);
} else {
    check(observed, skipped);
}
