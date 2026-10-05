import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAppProject, createAppProject, probeAppProject, removeAppProject } from "./app-project.js";

type WorkerPathCase = {
    applicationId: string;
    entry: string;
    expected: string;
    files: Record<string, string>;
    prefix: string;
    title: string;
};

type WorkerErrorCase = {
    applicationId: string;
    entry: string;
    files: Record<string, string>;
    prefix: string;
    title: string;
};

const ANSWER = 42;
const BUILD_TIMEOUT = 120_000;
const OUT_DIR = "dist";
const NATIVE_TYPE = "GObject";
const CALLER_NAME = "answer-caller.mjs";
const RELAY_NAME = "relay-worker.mjs";
const WORKER_NAME = "answer-worker.mjs";
const CALLER_SOURCE_PATH = join("src", CALLER_NAME);
const RELAY_SOURCE_PATH = join("src", RELAY_NAME);
const WORKER_SOURCE_PATH = join("src", WORKER_NAME);

const WORKER_SOURCE = `import { parentPort } from "node:worker_threads";

parentPort?.postMessage(${String(ANSWER)});
`;

const CALLER_SOURCE = `import { once } from "node:events";
import { Worker } from "node:worker_threads";

const answer = async () => {
    const worker = new Worker(new URL("./${WORKER_NAME}", import.meta.url));
    const [message] = await once(worker, "message");

    return message;
};

export { answer };
`;

const RELAY_SOURCE = `import { once } from "node:events";
import { parentPort, Worker } from "node:worker_threads";
import { answer } from "./${CALLER_NAME}";

const sibling = new Worker(new URL("./${WORKER_NAME}", import.meta.url));
const [direct] = await once(sibling, "message");

parentPort?.postMessage((await answer()) + direct);
`;

const STATIC_ENTRY = String.raw`import { typeFromName } from "@gtkx/runtime";
import { answer } from "./${CALLER_NAME}";

process.stdout.write(String(await answer()) + ":" + typeof typeFromName("${NATIVE_TYPE}") + "\n");
`;

const DYNAMIC_ENTRY = String.raw`const { answer } = await import("./${CALLER_NAME}");

process.stdout.write(String(await answer()) + "\n");
`;

const SHARED_ENTRY = String.raw`import { once } from "node:events";
import { Worker } from "node:worker_threads";
import { answer } from "./${CALLER_NAME}";

const shared = await answer();
const inline = new Worker(new URL("./${WORKER_NAME}", import.meta.url));
const [own] = await once(inline, "message");
const relay = new Worker(new URL("./${RELAY_NAME}", import.meta.url));
const [relayed] = await once(relay, "message");

process.stdout.write(shared + ":" + own + ":" + relayed + "\n");
`;

const HOISTED_ENTRY = `import { Worker } from "node:worker_threads";

const url = new URL("./${WORKER_NAME}", import.meta.url);

new Worker(url);
`;

const MISSING_ENTRY = `import { Worker } from "node:worker_threads";

new Worker(new URL("./missing-worker.mjs", import.meta.url));
`;

const CALLER_FILES: Record<string, string> = {
    [CALLER_SOURCE_PATH]: CALLER_SOURCE,
    [WORKER_SOURCE_PATH]: WORKER_SOURCE,
};

const WORKER_PATH_CASES: WorkerPathCase[] = [
    {
        applicationId: "com.gtkx.cliworkerstatic",
        entry: STATIC_ENTRY,
        expected: `${String(ANSWER)}:bigint`,
        files: CALLER_FILES,
        prefix: "gtkx-worker-static-",
        title: "a statically imported caller beside the native binding",
    },
    {
        applicationId: "com.gtkx.cliworkerdynamic",
        entry: DYNAMIC_ENTRY,
        expected: String(ANSWER),
        files: CALLER_FILES,
        prefix: "gtkx-worker-dynamic-",
        title: "a dynamically imported caller",
    },
    {
        applicationId: "com.gtkx.cliworkershared",
        entry: SHARED_ENTRY,
        expected: `${String(ANSWER)}:${String(ANSWER)}:${String(ANSWER * 2)}`,
        files: { ...CALLER_FILES, [RELAY_SOURCE_PATH]: RELAY_SOURCE },
        prefix: "gtkx-worker-shared-",
        title: "one worker claimed from the entry, a shared chunk and another worker",
    },
];

const WORKER_ERROR_CASES: WorkerErrorCase[] = [
    {
        applicationId: "com.gtkx.cliworkerhoisted",
        entry: HOISTED_ENTRY,
        files: { [WORKER_SOURCE_PATH]: WORKER_SOURCE },
        prefix: "gtkx-worker-hoisted-",
        title: "the worker URL is bound before the construction",
    },
    {
        applicationId: "com.gtkx.cliworkermissing",
        entry: MISSING_ENTRY,
        files: {},
        prefix: "gtkx-worker-missing-",
        title: "the worker specifier resolves to no module",
    },
];

describe("gtkx build (worker URLs)", () => {
    it.each(WORKER_PATH_CASES)(
        "starts the worker from $title",
        async ({ applicationId, entry, expected, files, prefix }) => {
            const probe = await probeAppProject({ applicationId, entry, files, outDir: OUT_DIR, prefix });

            try {
                expect(probe.run.status).toBe(0);
                expect(probe.run.stdout.trim()).toBe(expected);
            } finally {
                removeAppProject(probe.project);
            }
        },
        BUILD_TIMEOUT,
    );

    it.each(WORKER_ERROR_CASES)(
        "fails the build when $title",
        async ({ applicationId, entry, files, prefix }) => {
            const project = createAppProject({ applicationId, entry, files, prefix });

            try {
                await expect(buildAppProject({ project, outDir: OUT_DIR })).rejects.toThrow();
            } finally {
                removeAppProject(project);
            }
        },
        BUILD_TIMEOUT,
    );
});
