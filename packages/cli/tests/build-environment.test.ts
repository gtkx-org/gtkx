import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    type AppProject,
    type AppRun,
    buildAppProject,
    createAppProject,
    deployedEnvironment,
    removeAppProject,
    runNode,
} from "./app-project.js";

const BUILD_TIMEOUT = 120_000;
const RUN_TIMEOUT = 60_000;
const OUT_DIR = "dist";
const JSX_VIEW_PATH = join("src", "view.tsx");
const WORKER_PATH = join("src", "environment-worker.mjs");
const SHARED_PATH = join("src", "environment-shared.mjs");
const APPLICATION_ID = "com.gtkx.clibuildenvironment";
const SCHEMA_NAME = `${APPLICATION_ID}.gschema.xml`;
const SCHEMA_PATH = join("data", SCHEMA_NAME);
const ICON_PATH = join("icons", "hicolor", "scalable", "apps", `${APPLICATION_ID}.svg`);

const JSX_ENTRY = `import value from "./view.tsx";

process.stdout.write("jsx=" + value);
`;

const JSX_VIEW = `const view = <span data-state="ready" />;

export default view.props["data-state"];
`;

const ENVIRONMENT_CONFIG = `export default {
    applicationId: "${APPLICATION_ID}",
    applicationIcon: "application.svg",
    codegen: false,
};
`;

const ENVIRONMENT_SCHEMA = `<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="${APPLICATION_ID}" path="/com/gtkx/clibuildenvironment/">
        <key name="enabled" type="b">
            <default>true</default>
        </key>
    </schema>
</schemalist>
`;

const SHARED_SOURCE = `import { existsSync } from "node:fs";
import { join } from "node:path";
import schema from "../data/${SCHEMA_NAME}";

function process(value) {
    return value;
}

const hasFile = (variable, relativePath) =>
    (globalThis.process.env[variable] ?? "")
        .split(":")
        .filter(Boolean)
        .some((directory) => existsSync(join(directory, relativePath)));

const environmentReady = () => process(
    schema.id === "${APPLICATION_ID}" &&
    hasFile("GSETTINGS_SCHEMA_DIR", "gschemas.compiled") &&
    hasFile("XDG_DATA_DIRS", ${JSON.stringify(ICON_PATH)}),
);

const readyDuringDependencyEvaluation = environmentReady();

export { environmentReady, readyDuringDependencyEvaluation };
`;

const WORKER_SOURCE = `import { parentPort } from "node:worker_threads";
import { environmentReady, readyDuringDependencyEvaluation } from "./environment-shared.mjs";

const result = {
    entry: environmentReady(),
    shared: readyDuringDependencyEvaluation,
};

if (parentPort === null) {
    process.stdout.write(JSON.stringify(result));
} else {
    parentPort.postMessage(result);
}
`;

const ENVIRONMENT_ENTRY = `import { Worker } from "node:worker_threads";
import { environmentReady, readyDuringDependencyEvaluation } from "./environment-shared.mjs";

const worker = new Worker(new URL("./environment-worker.mjs", import.meta.url));

worker.on("message", (workerResult) => {
    process.stdout.write(JSON.stringify({
        entry: environmentReady(),
        shared: readyDuringDependencyEvaluation,
        worker: workerResult,
    }));
});

worker.on("error", (error) => {
    process.stderr.write(error.message);
    process.exitCode = 1;
});
`;

const buildWithNodeEnv = async (project: AppProject, nodeEnv: string): Promise<string> => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = nodeEnv;

    try {
        return await buildAppProject({ project, outDir: OUT_DIR });
    } finally {
        if (previous === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = previous;
        }
    }
};

const runWithoutDataEnvironment = (file: string): AppRun => {
    const env = deployedEnvironment();
    delete env.GSETTINGS_SCHEMA_DIR;
    delete env.XDG_DATA_DIRS;
    const result = spawnSync(process.execPath, [file], {
        cwd: dirname(file),
        encoding: "utf8",
        env,
        timeout: RUN_TIMEOUT,
    });

    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};

describe("gtkx build (production environment)", () => {
    it("emits runnable JSX when the caller environment is not production", async () => {
        const project = createAppProject({
            applicationId: "com.gtkx.clibuildjsx",
            entry: JSX_ENTRY,
            files: { [JSX_VIEW_PATH]: JSX_VIEW },
            prefix: "gtkx-build-jsx-environment-",
        });

        try {
            const bundle = await buildWithNodeEnv(project, "test");
            const run = runNode(join(project.root, bundle));
            expect(run.stderr).toBe("");
            expect(run.stdout).toBe("jsx=ready");
            expect(run.status).toBe(0);
        } finally {
            removeAppProject(project);
        }
    }, BUILD_TIMEOUT);
});

describe("gtkx build (data environment across chunks)", () => {
    it("initializes shared, application, and worker modules from the output root", async () => {
        const project = createAppProject({
            applicationId: APPLICATION_ID,
            entry: ENVIRONMENT_ENTRY,
            files: {
                "application.svg": "<svg/>\n",
                "gtkx.config.mjs": ENVIRONMENT_CONFIG,
                [SCHEMA_PATH]: ENVIRONMENT_SCHEMA,
                [SHARED_PATH]: SHARED_SOURCE,
                [WORKER_PATH]: WORKER_SOURCE,
            },
            prefix: "gtkx-build-data-environment-",
        });

        try {
            const bundle = await buildAppProject({ project, outDir: OUT_DIR });
            const output = join(project.root, OUT_DIR);
            const appRun = runWithoutDataEnvironment(join(project.root, bundle));
            expect(appRun.stderr).toBe("");
            expect(JSON.parse(appRun.stdout)).toEqual({
                entry: true,
                shared: true,
                worker: { entry: true, shared: true },
            });
            expect(appRun.status).toBe(0);

            const workerName = readdirSync(output, { recursive: true, encoding: "utf8" }).find((name) =>
                name.startsWith("workers/") && name.endsWith(".mjs"),
            );

            if (workerName === undefined) {
                throw new Error("Build emitted no worker entry");
            }

            const workerRun = runWithoutDataEnvironment(join(output, workerName));
            expect(workerRun.stderr).toBe("");
            expect(JSON.parse(workerRun.stdout)).toEqual({ entry: true, shared: true });
            expect(workerRun.status).toBe(0);
        } finally {
            removeAppProject(project);
        }
    }, BUILD_TIMEOUT);
});
