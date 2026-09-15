import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    type DisposableCliProject,
    runCliOrThrow,
    STORE_LIBRARIES,
} from "./cli-project.js";

type AppRun = { status: number | null; signal: NodeJS.Signals | null; reports: unknown[] };

const source = readFileSync(new URL("fixtures/custom-elements.tsx", import.meta.url), "utf8");
const configured = { digits: 3, tag: "volume", token: "session", constructed: ["session"] };

const runApp = (project: CliProject, mode: string): Promise<AppRun> => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(project.root, "dist/bundle.mjs")], {
        cwd: join(project.root, "dist"),
        env: { ...process.env, GTKX_CUSTOM_ELEMENT_MODE: mode },
        stdio: ["ignore", "ignore", "inherit", "ipc"],
    });
    const reports: unknown[] = [];
    const timeout = setTimeout(() => {
        child.kill("SIGKILL");
    }, 30_000);

    child.on("message", (message) => {
        reports.push(message);
        if (mode !== "defaults" && reports.length === 1) {
            child.send({ phase: 1 });
        }
    });
    child.once("error", reject);
    child.once("close", (status, signal) => {
        clearTimeout(timeout);
        resolve({ status, signal, reports });
    });
});

describe("production custom JSX elements", () => {
    let project: DisposableCliProject;

    beforeAll(() => {
        project = createCliProject({
            prefix: "gtkx-custom-elements-build-",
            config: "export default { applicationId: \"com.gtkx.clicustomelements\", " +
                `libraries: ${JSON.stringify(STORE_LIBRARIES)} };`,
            files: { "src/index.tsx": source },
            hasStore: true,
        });
        runCliOrThrow(project, ["build"]);
    });

    afterAll(() => {
        project[Symbol.dispose]();
    });

    it("restores inherited and declared property defaults when JSX props are removed", async () => {
        const result = await runApp(project, "remove");

        expect(result.status).toBe(0);
        expect(result.signal).toBeNull();
        expect(result.reports).toEqual([
            configured,
            { digits: 1, tag: "untagged", token: "session", constructed: ["session"] },
        ]);
    });

    it("keeps native defaults when the custom element omits its optional props", async () => {
        const result = await runApp(project, "defaults");

        expect(result.status).toBe(0);
        expect(result.signal).toBeNull();
        expect(result.reports).toEqual([
            { digits: 1, tag: "untagged", token: "default-token", constructed: ["default-token"] },
        ]);
    });

    it("rejects a construct-only prop update after delivering its initial value during construction", async () => {
        const result = await runApp(project, "update");

        expect(result.reports[0]).toEqual(configured);
        expect(result.status).toBe(17);
        expect(result.signal).toBeNull();
    });
});
