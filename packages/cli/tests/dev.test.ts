import type { ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type CliProject,
    createCliProject,
    removeCliProject,
    runCli,
    startCli,
    STORE_FUTURE,
    STORE_LIBRARIES,
} from "./cli-project.js";

type DevSession = { output: () => string; isRunning: () => boolean; stop: () => Promise<boolean> };

const APPLICATION_ID = "com.gtkx.clidev";
const READY_MARKER = "dev-ready";
const POLL_INTERVAL = 200;
const START_TIMEOUT = 120_000;
const RELOAD_TIMEOUT = 120_000;
const STOP_TIMEOUT = 15_000;
const APP_MODULE = join("src", "app.tsx");
const ENTRY_MODULE = join("src", "index.tsx");

const ENTRY_SOURCE = `import { createRoot } from "@gtkx/react";
import { App } from "./app.js";

createRoot().render(<App />);
`;

const BROKEN_SOURCE = `import { Absent } from "./absent.js";

const App = () => <Absent;

export { App };
`;

const APP_HEAD = `import { GtkLabel } from "@gtkx/jsx";
import { GtkApplication, GtkApplicationWindow } from "@gtkx/jsx/gtk";
import { useEffect } from "react";

const REVISION = `;

const APP_BODY = String.raw`;

const App = () => {
    useEffect(() => {
        process.stdout.write("${READY_MARKER} " + REVISION + "\n");
    });

    return (
        <GtkApplication>
            <GtkApplicationWindow title="Probe">
                <GtkLabel label="probe" />
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

export { App };
`;

const appSource = (revision: string): string => `${APP_HEAD}${JSON.stringify(revision)}${APP_BODY}`;

const config = (): string =>
    `export default { applicationId: "${APPLICATION_ID}", libraries: ${JSON.stringify(STORE_LIBRARIES)}, ` +
    `future: ${JSON.stringify(STORE_FUTURE)} };\n`;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const writeApp = (project: CliProject, source: string): void => {
    writeFileSync(join(project.root, APP_MODULE), source);
};

const collect = (child: ChildProcess, append: (chunk: string) => void): void => {
    child.stdout?.on("data", (chunk: Buffer) => {
        append(chunk.toString());
    });

    child.stderr?.on("data", (chunk: Buffer) => {
        append(chunk.toString());
    });
};

const exited = (child: ChildProcess): Promise<void> =>
    new Promise((resolve) => {
        child.once("exit", () => {
            resolve();
        });
    });

const startDev = (project: CliProject): DevSession => {
    const child = startCli(project, ["dev"]);
    let buffer = "";

    collect(child, (chunk) => {
        buffer += chunk;
    });

    const isRunning = (): boolean => child.exitCode === null && child.signalCode === null;

    return {
        output: () => buffer,
        isRunning,
        stop: async () => {
            if (isRunning()) {
                child.kill("SIGTERM");
                await Promise.race([exited(child), delay(STOP_TIMEOUT)]);
            }

            return !isRunning();
        },
    };
};

const waitForOutput = async (session: DevSession, needle: string, timeout: number): Promise<string> => {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        if (session.output().includes(needle)) {
            return session.output();
        }

        await delay(POLL_INTERVAL);
    }

    return session.output();
};

describe("gtkx dev", () => {
    const state: { project: CliProject; session: DevSession } = {
        project: { root: "", nodeModules: "" },
        session: { output: () => "", isRunning: () => false, stop: () => Promise.resolve(true) },
    };

    beforeAll(() => {
        state.project = createCliProject({
            prefix: "gtkx-cli-dev-",
            config: config(),
            files: { [ENTRY_MODULE]: ENTRY_SOURCE, [APP_MODULE]: appSource("one") },
            hasStore: true,
        });

        state.session = startDev(state.project);
    });

    afterAll(async () => {
        await state.session.stop();
        removeCliProject(state.project);
    });

    it("starts the application, and reloads it when a component changes", async () => {
        expect(await waitForOutput(state.session, `${READY_MARKER} one`, START_TIMEOUT)).toContain(
            `${READY_MARKER} one`,
        );

        writeApp(state.project, appSource("two"));

        expect(await waitForOutput(state.session, `${READY_MARKER} two`, RELOAD_TIMEOUT)).toContain(
            `${READY_MARKER} two`,
        );
    });

    it("stays up when a component stops compiling, and reloads it once it compiles again", async () => {
        writeApp(state.project, BROKEN_SOURCE);
        await delay(POLL_INTERVAL * 5);
        expect(state.session.isRunning()).toBe(true);
        writeApp(state.project, appSource("three"));

        expect(await waitForOutput(state.session, `${READY_MARKER} three`, RELOAD_TIMEOUT)).toContain(
            `${READY_MARKER} three`,
        );
    });

    it("stops the application when it is asked to stop", async () => {
        expect(await state.session.stop()).toBe(true);
    });
});

describe("gtkx dev (projects it refuses to start)", () => {
    it("fails when the project has no entry file", () => {
        const project = createCliProject({ prefix: "gtkx-cli-dev-broken-", config: config(), hasStore: true });

        try {
            expect(runCli(project, ["dev"]).status).not.toBe(0);
        } finally {
            removeCliProject(project);
        }
    });
});
