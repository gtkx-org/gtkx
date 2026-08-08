import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultForkRunner, type SupervisedChild } from "../../src/dev/supervisor.js";

type ForkReport = {
    resolved: string;
    execArgv: string[];
    nodeOptions: string;
};

const PROBE_PATH = fileURLToPath(new URL("fixtures/resolve-probe.mjs", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const PROBE_TIMEOUT_MS = 20_000;
const SOURCE_EXEC_ARGV = ["--import", "tsx", "--conditions=source"];

const waitForExit = (child: SupervisedChild): Promise<void> =>
    new Promise((resolve) => {
        child.once("exit", () => {
            resolve();
        });
    });

const runProbe = async (directory: string, env: NodeJS.ProcessEnv): Promise<ForkReport> => {
    const reportPath = join(directory, "report.json");
    await waitForExit(defaultForkRunner(PROBE_PATH, [reportPath], env, REPO_ROOT));

    return JSON.parse(readFileSync(reportPath, "utf8")) as ForkReport;
};

const probeWith = (
    directory: string,
    execArgv: string[],
    env: NodeJS.ProcessEnv = process.env,
): Promise<ForkReport> => {
    process.execArgv = execArgv;

    return runProbe(directory, env);
};

describe("defaultForkRunner", () => {
    let directory = "";
    let parentExecArgv: string[] = [];

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "gtkx-fork-"));
        parentExecArgv = process.execArgv;
    });

    afterEach(() => {
        process.execArgv = parentExecArgv;
        rmSync(directory, { recursive: true, force: true });
    });

    it("resolves the runtime in the application process the way Vite externalizes it", async () => {
        const report = await probeWith(directory, SOURCE_EXEC_ARGV);
        expect(report.resolved).toContain("/packages/runtime/dist/");
        expect(report.resolved).not.toContain("/packages/runtime/src/");
    }, PROBE_TIMEOUT_MS);

    it("keeps the parent flags that do not decide module resolution", async () => {
        const report = await probeWith(directory, SOURCE_EXEC_ARGV);
        expect(report.execArgv).toEqual(["--import", "tsx"]);
    }, PROBE_TIMEOUT_MS);

    it("drops a condition written as two arguments without dropping the flag after it", async () => {
        const report = await probeWith(directory, ["--conditions", "source", "--no-warnings"]);
        expect(report.execArgv).toEqual(["--no-warnings"]);
        expect(report.resolved).toContain("/packages/runtime/dist/");
    }, PROBE_TIMEOUT_MS);

    it("drops a condition that arrives through NODE_OPTIONS", async () => {
        const report = await probeWith(directory, [], {
            ...process.env,
            NODE_OPTIONS: "--no-warnings --conditions=source",
        });

        expect(report.nodeOptions).toBe("--no-warnings");
        expect(report.resolved).toContain("/packages/runtime/dist/");
    }, PROBE_TIMEOUT_MS);
});
