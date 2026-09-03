import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow } from "./cli-project.js";
import {
    PINNED_SOURCE,
    PNPM_PIN,
    SOURCE_ARGS,
    sourceConfig,
    sourceFiles,
} from "./deploy-helpers.js";

const DEFAULT_ID = "com.gtkx.configdefault";
const EDITION_ID = "com.gtkx.configedition";
const EDITION_CONFIG = "gtkx.edition.config.ts";
const VITEST_CONFIG = "vitest.config.ts";
const VITEST_TEST = join("tests", "config-selection.test.ts");
const VITEST_ENTRY = fileURLToPath(new URL("../../../node_modules/vitest/vitest.mjs", import.meta.url));
const CLI_PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const PROCESS_TIMEOUT = 120_000;
const ENTRY = `import { applicationId } from "virtual:gtkx-config";

process.stdout.write(applicationId);
`;
const DEV_ENTRY = `${ENTRY}
process.exit(0);
`;

const baseConfig = `export default {
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
import base from "./gtkx.config.ts";

export default mergeConfig(base, {
    applicationId: "${EDITION_ID}",
    deploy: { name: "Selected Edition" },
});
`;

const projectFiles = (): Record<string, string> => ({
    [EDITION_CONFIG]: editionConfig,
    "application.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>\n',
    [join("src", "index.ts")]: ENTRY,
});

const selectedConfig = `export default {
    applicationId: "${EDITION_ID}",
    codegen: false,
};
`;

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

    it("lets codegen select a project-relative configuration file", () => {
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
        runCliOrThrow(project, ["codegen", "--config", "gtkx.codegen.config.ts"]);
    });

    it("uses one selected configuration through dev and Vitest", () => {
        using project = createCliProject({
            prefix: "gtkx-config-development-",
            config: "export default {};\n",
            files: {
                [EDITION_CONFIG]: selectedConfig,
                [join("src", "index.ts")]: DEV_ENTRY,
                [VITEST_CONFIG]: vitestConfig,
                [VITEST_TEST]: vitestTest,
            },
            hasStore: true,
        });

        const dev = runCliOrThrow(project, ["dev", "--config", EDITION_CONFIG]);
        expect(dev.output).toContain(EDITION_ID);
        runVitestOrThrow(project);
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
