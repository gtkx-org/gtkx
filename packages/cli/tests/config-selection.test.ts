import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow, startCli } from "./cli-project.js";
import {
    PINNED_SOURCE,
    PNPM_PIN,
    SOURCE_ARGS,
    sourceConfig,
    sourceFiles,
} from "./deploy-helpers.js";

const DEFAULT_ID = "com.gtkx.configdefault";
const EDITION_ID = "com.gtkx.configedition";
const REFRESHED_ID = "com.gtkx.configrefreshed";
const SWITCHED_ID = "com.gtkx.configswitched";
const REWATCHED_ID = "com.gtkx.configrewatched";
const RECOVERED_ID = "com.gtkx.configrecovered";
const LAYER_ID = "com.gtkx.configlayer";
const REFRESHED_LAYER_ID = "com.gtkx.configlayerrefreshed";
const RECOVERED_LAYER_ID = "com.gtkx.configlayerrecovered";
const NATIVE_ID = "com.gtkx.confignative";
const REFRESHED_NATIVE_ID = "com.gtkx.confignativerefreshed";
const JSON_NATIVE_ID = "com.gtkx.confignativejson";
const REFRESHED_JSON_NATIVE_ID = "com.gtkx.confignativejsonrefreshed";
const DIRECT_NATIVE_ID = "com.gtkx.confignativedirect";
const EDITION_CONFIG = "gtkx.edition.config.ts";
const SWITCHED_CONFIG = "gtkx.switched.config.ts";
const MISSING_CONFIG = "missing.ts";
const RELOAD_MARKER = "config-reload.started";
const LAYER_CONFIG = join("config", "gtkx.layer.config.yaml");
const LAYER_DIRECTORY = "base";
const LAYER_BASE_CONFIG = join(LAYER_DIRECTORY, LAYER_CONFIG);
const MISSING_LAYER_DIRECTORY = "missing-layer";
const MISSING_LAYER_CONFIG = join(MISSING_LAYER_DIRECTORY, LAYER_CONFIG);
const NATIVE_CONFIG = "gtkx.native.config.mjs";
const NATIVE_BASE_CONFIG = "gtkx.native.base.cjs";
const NATIVE_JSON_CONFIG = "gtkx.native.base.json";
const VITEST_CONFIG = "vitest.config.ts";
const VITEST_TEST = join("tests", "config-selection.test.ts");
const VITEST_ENTRY = fileURLToPath(new URL("../../../node_modules/vitest/vitest.mjs", import.meta.url));
const CLI_PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const PROCESS_TIMEOUT = 120_000;
const POLL_INTERVAL = 100;
const ENTRY = `import { applicationId } from "virtual:gtkx-config";

process.stdout.write(applicationId);
`;
const EXITING_DEV_ENTRY = `${ENTRY}
process.exit(0);
`;
const DEV_ENTRY = `${ENTRY}
setInterval(() => {}, 1_000);
`;
const DATA_CONFIGS = {
    "gtkx.config.json5": `{ applicationId: "${EDITION_ID}", codegen: false }\n`,
    "gtkx.config.jsonc": `{\n    "applicationId": "${EDITION_ID}",\n    "codegen": false,\n}\n`,
    "gtkx.config.yaml": `applicationId: ${EDITION_ID}\ncodegen: false\n`,
};

const baseConfig = `export const configRevision = "edition";

export default {
    applicationId: "${DEFAULT_ID}",
    applicationIcon: "application.svg",
    codegen: false,
    deploy: {
        name: "Default Edition",
        developer: { name: "GTKX" },
        summary: "Exercises the default configuration",
        description: ["A configuration selection integration probe."],
        categories: ["Utility"],
        license: "MPL-2.0",
        metadataLicense: "CC0-1.0",
    },
};
`;

const editionConfig = `import { mergeConfig } from "@gtkx/config";
import base, { configRevision } from "./gtkx.config.ts";

export default (context: { command?: string }) => {
    if (context.command !== undefined) throw new Error("configuration was loaded as a Vite config");

    return mergeConfig(base, {
        applicationId: "com.gtkx.config" + configRevision,
        deploy: { name: "Selected Edition" },
    });
};
`;

const projectFiles = (): Record<string, string> => ({
    [EDITION_CONFIG]: editionConfig,
    "application.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>\n',
    [join("src", "index.ts")]: ENTRY,
});

const vitestConfig = `import gtkx from "@gtkx/cli/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [gtkx({ configFile: "${EDITION_CONFIG}" })],
    test: { include: [${JSON.stringify(VITEST_TEST)}] },
});
`;

const vitestTest = `import { applicationId } from "virtual:gtkx-config";

it("uses the selected GTKX configuration", () => {
    expect(applicationId).toBe("${EDITION_ID}");
});
`;

const runVitestOrThrow = (project: CliProject): void => {
    symlinkSync(dirname(VITEST_ENTRY), join(project.nodeModules, "vitest"), "dir");
    symlinkSync(CLI_PACKAGE, join(project.nodeModules, "@gtkx", "cli"), "dir");
    const result = spawnSync(process.execPath, [VITEST_ENTRY, "run", "--config", VITEST_CONFIG], {
        cwd: project.root,
        encoding: "utf8",
        timeout: PROCESS_TIMEOUT,
    });

    if (result.status !== 0) {
        throw new Error(`${result.stdout}${result.stderr}`);
    }
};

const captureOutput = (child: ChildProcess): (() => string) => {
    let output = "";
    const append = (chunk: Buffer): void => {
        output += chunk.toString();
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);

    return () => output;
};

const waitForOutput = async (read: () => string, expected: string): Promise<string> => {
    const deadline = Date.now() + PROCESS_TIMEOUT;

    while (Date.now() < deadline && !read().includes(expected)) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }

    return read();
};

const waitForPath = async (path: string): Promise<void> => {
    const deadline = Date.now() + PROCESS_TIMEOUT;

    while (Date.now() < deadline && !existsSync(path)) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }

    if (!existsSync(path)) {
        throw new Error(`Timed out waiting for ${path}`);
    }
};

const blockedMissingConfig = `import { existsSync, writeFileSync } from "node:fs";

const missing = new URL("./${MISSING_CONFIG}", import.meta.url);

export default async () => {
    const shouldFail = !existsSync(missing);
    writeFileSync(new URL("./${RELOAD_MARKER}", import.meta.url), "");

    if (false) await import("./${MISSING_CONFIG}");

    if (shouldFail) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
        throw new Error("configuration dependency was initially missing");
    }

    return (await import("./${MISSING_CONFIG}")).default;
};
`;

const reloadMessage = (changedFile: string): string => `[gtkx] ${changedFile} changed; regenerating bindings`;

const stopCli = async (child: ChildProcess): Promise<void> => {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    const exited: Promise<void> = new Promise((resolve) => {
        child.once("exit", () => {
            resolve();
        });
    });
    child.kill("SIGTERM");
    await exited;
};

describe("GTKX configuration selection", () => {
    it("uses one selected configuration through build and deploy", () => {
        using project = createCliProject({
            prefix: "gtkx-config-selection-",
            config: baseConfig,
            files: projectFiles(),
            hasStore: true,
        });

        runCliOrThrow(project, ["build", "--config", EDITION_CONFIG]);
        const bundle = join(project.root, "dist", "bundle.mjs");
        const run = spawnSync(process.execPath, [bundle], { cwd: join(project.root, "dist"), encoding: "utf8" });
        expect(run.status).toBe(0);
        expect(run.stdout).toBe(EDITION_ID);

        runCliOrThrow(project, [
            "deploy",
            "--skip-build",
            "--print-manifests",
            "--target",
            "deb",
            "--config",
            EDITION_CONFIG,
        ]);
        expect(existsSync(join(project.root, "build", "metadata", `${EDITION_ID}.metainfo.xml`))).toBe(true);
    });

    it("lets codegen and dev select project-relative configuration files", () => {
        using project = createCliProject({
            prefix: "gtkx-config-codegen-",
            config: "export default {};\n",
            files: {
                "gtkx.codegen.config.ts": `export default { applicationId: "${EDITION_ID}", codegen: false };\n`,
            },
            hasStore: true,
        });

        expect(() => runCliOrThrow(project, ["codegen"])).toThrow();
        expect(() => runCliOrThrow(project, ["codegen", "--config", "missing.config.ts"])).toThrow();
        expect(() => runCliOrThrow(project, ["dev", "--config", "missing.config.ts"])).toThrow();
        runCliOrThrow(project, ["codegen", "--config", "gtkx.codegen.config.ts"]);

        using dataProject = createCliProject({
            prefix: "gtkx-config-data-",
            config: "export default {};\n",
            files: {
                ...DATA_CONFIGS,
                [join("src", "index.ts")]: EXITING_DEV_ENTRY,
            },
            hasStore: true,
        });

        for (const configFile of Object.keys(DATA_CONFIGS)) {
            expect(runCliOrThrow(dataProject, ["dev", "--config", configFile]).output).toContain(EDITION_ID);
        }
    });

    it("uses and watches one selected configuration through dev and Vitest", async () => {
        using project = createCliProject({
            prefix: "gtkx-config-development-",
            config: baseConfig,
            files: {
                [EDITION_CONFIG]: editionConfig.replace("./gtkx.config.ts", "#base"),
                [SWITCHED_CONFIG]: baseConfig.replace('configRevision = "edition"', 'configRevision = "switched"'),
                "application.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>\n',
                [join("src", "index.ts")]: DEV_ENTRY,
                [VITEST_CONFIG]: vitestConfig,
                [VITEST_TEST]: vitestTest,
            },
            hasStore: true,
        });
        const manifestPath = join(project.root, "package.json");
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
        writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, imports: { "#base": "./gtkx.config.ts" } })}\n`);

        runVitestOrThrow(project);
        const child = startCli(project, ["dev", "--config", EDITION_CONFIG]);
        const output = captureOutput(child);

        try {
            expect(await waitForOutput(output, EDITION_ID)).toContain(EDITION_ID);
            writeFileSync(
                join(project.root, "gtkx.config.ts"),
                baseConfig.replace('configRevision = "edition"', 'configRevision = "refreshed"'),
            );
            const refreshed = await waitForOutput(output, REFRESHED_ID);
            expect(refreshed).toContain(REFRESHED_ID);
            expect(refreshed).toContain(reloadMessage("gtkx.config.ts"));
            writeFileSync(
                join(project.root, EDITION_CONFIG),
                editionConfig.replace("./gtkx.config.ts", () => `./${SWITCHED_CONFIG}`),
            );
            const switched = await waitForOutput(output, SWITCHED_ID);
            expect(switched).toContain(SWITCHED_ID);
            expect(switched).toContain(reloadMessage(EDITION_CONFIG));
            writeFileSync(
                join(project.root, SWITCHED_CONFIG),
                baseConfig.replace('configRevision = "edition"', 'configRevision = "rewatched"'),
            );
            const rewatched = await waitForOutput(output, REWATCHED_ID);
            expect(rewatched).toContain(REWATCHED_ID);
            expect(rewatched).toContain(reloadMessage(SWITCHED_CONFIG));
            writeFileSync(join(project.root, EDITION_CONFIG), blockedMissingConfig);
            await waitForPath(join(project.root, RELOAD_MARKER));
            writeFileSync(
                join(project.root, MISSING_CONFIG),
                `export default { applicationId: "${RECOVERED_ID}", codegen: false };\n`,
            );
            const recovered = await waitForOutput(output, RECOVERED_ID);
            expect(recovered).toContain(RECOVERED_ID);
            expect(recovered).toContain(reloadMessage(MISSING_CONFIG));
        } finally {
            await stopCli(child);
        }
    });

    it("watches c12 configuration layers", async () => {
        using project = createCliProject({
            prefix: "gtkx-config-layers-",
            config: "export default {};\n",
            files: {
                [LAYER_CONFIG]: `extends: ./${LAYER_DIRECTORY}\ncodegen: false\n`,
                [LAYER_BASE_CONFIG]: `applicationId: ${LAYER_ID}\n`,
                [join(dirname(MISSING_LAYER_CONFIG), ".keep")]: "",
                [join("src", "index.ts")]: DEV_ENTRY,
            },
            hasStore: true,
        });
        const child = startCli(project, ["dev", "--config", LAYER_CONFIG]);
        const output = captureOutput(child);

        try {
            expect(await waitForOutput(output, LAYER_ID)).toContain(LAYER_ID);
            writeFileSync(
                join(project.root, LAYER_BASE_CONFIG),
                `applicationId: ${REFRESHED_LAYER_ID}\n`,
            );
            const refreshed = await waitForOutput(output, REFRESHED_LAYER_ID);
            expect(refreshed).toContain(REFRESHED_LAYER_ID);
            expect(refreshed).toContain(reloadMessage(LAYER_BASE_CONFIG));
            writeFileSync(
                join(project.root, LAYER_CONFIG),
                `extends: ./${MISSING_LAYER_DIRECTORY}\ncodegen: false\n`,
            );
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL * 5));
            writeFileSync(
                join(project.root, MISSING_LAYER_CONFIG),
                `applicationId: ${RECOVERED_LAYER_ID}\n`,
            );
            const recovered = await waitForOutput(output, RECOVERED_LAYER_ID);
            expect(recovered).toContain(RECOVERED_LAYER_ID);
            expect(recovered).toContain(reloadMessage(MISSING_LAYER_CONFIG));
        } finally {
            await stopCli(child);
        }
    });

    it("reloads native JavaScript configuration modules", async () => {
        using project = createCliProject({
            prefix: "gtkx-config-native-",
            config: "export default {};\n",
            files: {
                [NATIVE_CONFIG]: `import base from "./${NATIVE_BASE_CONFIG}";\nexport default base;\n`,
                [NATIVE_BASE_CONFIG]: `module.exports = { applicationId: "${NATIVE_ID}", codegen: false };\n`,
                [NATIVE_JSON_CONFIG]: `{"applicationId":"${JSON_NATIVE_ID}","codegen":false}\n`,
                [join("src", "index.ts")]: DEV_ENTRY,
            },
            hasStore: true,
        });
        const child = startCli(project, ["dev", "--config", NATIVE_CONFIG]);
        const output = captureOutput(child);

        try {
            expect(await waitForOutput(output, NATIVE_ID)).toContain(NATIVE_ID);
            writeFileSync(
                join(project.root, NATIVE_BASE_CONFIG),
                `module.exports = { applicationId: "${REFRESHED_NATIVE_ID}", codegen: false };\n`,
            );
            const refreshed = await waitForOutput(output, REFRESHED_NATIVE_ID);
            expect(refreshed).toContain(REFRESHED_NATIVE_ID);
            expect(refreshed).toContain(reloadMessage(NATIVE_BASE_CONFIG));
            writeFileSync(
                join(project.root, NATIVE_CONFIG),
                `import base from "./${NATIVE_JSON_CONFIG}" with { type: "json" };\nexport default base;\n`,
            );
            expect(await waitForOutput(output, JSON_NATIVE_ID)).toContain(JSON_NATIVE_ID);
            writeFileSync(
                join(project.root, NATIVE_JSON_CONFIG),
                `{"applicationId":"${REFRESHED_JSON_NATIVE_ID}","codegen":false}\n`,
            );
            const refreshedJson = await waitForOutput(output, REFRESHED_JSON_NATIVE_ID);
            expect(refreshedJson).toContain(REFRESHED_JSON_NATIVE_ID);
            expect(refreshedJson).toContain(reloadMessage(NATIVE_JSON_CONFIG));
            writeFileSync(
                join(project.root, NATIVE_CONFIG),
                `export default { applicationId: "${DIRECT_NATIVE_ID}", codegen: false };\n`,
            );
            expect(await waitForOutput(output, DIRECT_NATIVE_ID)).toContain(DIRECT_NATIVE_ID);
        } finally {
            await stopCli(child);
        }
    });

    it("keeps the selected configuration in a Flatpak source build", () => {
        using project = createCliProject({
            prefix: "gtkx-config-source-",
            config: baseConfig,
            files: {
                ...sourceFiles(PNPM_PIN),
                [EDITION_CONFIG]: sourceConfig(PINNED_SOURCE),
            },
            hasStore: true,
        });

        runCliOrThrow(project, [...SOURCE_ARGS, "--config", EDITION_CONFIG]);
        const manifest = readFileSync(
            join(project.root, "build", "targets", "flatpak", "com.gtkx.clideploy.yml"),
            "utf8",
        );
        expect(manifest).toContain(`npx gtkx build --config ${EDITION_CONFIG}`);
    });

    it("refuses to deploy a bundle built with another configuration", () => {
        using project = createCliProject({
            prefix: "gtkx-config-mismatch-",
            config: baseConfig,
            files: projectFiles(),
            hasStore: true,
        });

        runCliOrThrow(project, ["build"]);
        expect(() => runCliOrThrow(project, [
            "deploy",
            "--skip-build",
            "--print-manifests",
            "--target",
            "deb",
            "--config",
            EDITION_CONFIG,
        ])).toThrow();

        runCliOrThrow(project, ["build", "--config", EDITION_CONFIG]);
        writeFileSync(
            join(project.root, EDITION_CONFIG),
            editionConfig.replace("Selected Edition", "Changed Edition"),
        );
        expect(() => runCliOrThrow(project, [
            "deploy",
            "--skip-build",
            "--print-manifests",
            "--target",
            "deb",
            "--config",
            EDITION_CONFIG,
        ])).toThrow();
    });

    it("rejects configuration paths outside the project", () => {
        using project = createCliProject({
            prefix: "gtkx-config-outside-",
            config: baseConfig,
            files: projectFiles(),
            hasStore: true,
        });

        expect(() => runCliOrThrow(project, ["build", "--config", "../gtkx.config.ts"])).toThrow();
    });
});
