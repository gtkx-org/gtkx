import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    type AppProject,
    type AppRun,
    buildAppProject,
    createAppProject,
    deployedEnvironment,
    installBundle,
    removeAppProject,
    runNode,
} from "./app-project.js";

type InstalledBundle = { project: AppProject; installDir: string; source: string; run: AppRun };
type ReactManifest = { version: string; description: string };
type ResolvingCase = { title: string; specifier: string; applicationId: string; prefix: string };
type ResolverSyntaxCase = { title: string; entry: string; applicationId: string; prefix: string };

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const VERSION_PREFIX = "rendererVersion=";
const BUILD_TIMEOUT = 120_000;
const OUT_DIR = "dist";
const BUNDLE_NAME = "bundle.mjs";
const REACT_PACKAGE = "@gtkx/react";
const REACT_MANIFEST = `${REACT_PACKAGE}/package.json`;
const SIBLING_MANIFEST = "./package.json";
const MISSING_MODULE = "Cannot find module";
const WORKER_NAME = "indexer.mjs";
const WORKER_SOURCE_PATH = join("src", WORKER_NAME);
const ASSETS_DIR = "assets";
const WORKER_DIR = "workers";
const SHARED_NAME = "totals.mjs";
const SHARED_SOURCE_PATH = join("src", SHARED_NAME);
const ESM_EXTENSION = ".mjs";
const SCRIPT_EXTENSIONS = new Set([".cjs", ".js", ".mjs"]);

const APP_ENTRY = String.raw`import { createRoot } from "@gtkx/react";

const injected = [];

globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: (internals) => {
        injected.push(internals.version);

        return 1;
    },
};

createRoot();

process.stdout.write("${VERSION_PREFIX}" + injected.join(",") + "\n");
`;

const WORKER_APP_ENTRY = `import { Worker } from "node:worker_threads";
import { createRoot } from "@gtkx/react";
import { half } from "./${SHARED_NAME}";

const worker = new Worker(new URL("./${WORKER_NAME}", import.meta.url));

worker.on("message", (total) => {
    process.stdout.write("total=" + (total + half(0)));
});

createRoot();
`;

const WORKER_SOURCE = `import { parentPort } from "node:worker_threads";
import { half } from "./${SHARED_NAME}";

parentPort?.postMessage(half(42) + half(42));
`;

const SHARED_SOURCE = `const half = (total) => total / 2;

export { half };
`;

const RESOLVING_CASES: ResolvingCase[] = [
    {
        title: "a gtkx manifest resolved out of node_modules",
        specifier: REACT_MANIFEST,
        applicationId: "com.gtkx.clibundleresolver",
        prefix: "gtkx-bundle-resolver-",
    },
    {
        title: "a manifest read beside the bundle",
        specifier: SIBLING_MANIFEST,
        applicationId: "com.gtkx.clibundlesibling",
        prefix: "gtkx-bundle-sibling-",
    },
];

const resolvingEntry = (specifier: string): string => String.raw`import { createRequire } from "node:module";

globalThis.__gtkxLateVersion = () => createRequire(import.meta.url)("${specifier}").version;

process.stdout.write("started\n");
`;

const SCOPED_RESOLVER_ENTRY = String.raw`import { createRequire as factory } from "node:module";

const load = factory(import.meta.url);
const retain = (load) => load;
globalThis.__gtkxRetain = retain;
globalThis.__gtkxLateVersion = () => load("picomatch").version;
process.stdout.write("started\n");
`;

const LOCAL_FACTORY_ENTRY = `const moduleApi = {
    createRequire: (url) => (specifier) => url + ":" + specifier,
};
const createRequire = moduleApi.createRequire;
const require = () => moduleApi;

process.stdout.write([
    createRequire(import.meta.url)("picomatch"),
    moduleApi.createRequire(import.meta.url)("picomatch"),
    require("node:module").createRequire(import.meta.url)("picomatch"),
].join(","));
`;

const resolverSyntaxEntry = (setup: string, mutation = ""): string => String.raw`${setup}

${mutation}globalThis.__gtkxLateVersion = () => load("picomatch").version;
process.stdout.write("started\n");
`;

const RESOLVER_SYNTAX_CASES: ResolverSyntaxCase[] = [
    {
        title: "a mutable resolver binding",
        entry: resolverSyntaxEntry(
            'import { createRequire } from "node:module";\nlet load = createRequire(import.meta.url);',
            `if (globalThis.__gtkxUseLocalResolver) {
    load = (specifier) => ({ version: specifier });
}
`,
        ),
        applicationId: "com.gtkx.clibundlemutable",
        prefix: "gtkx-bundle-mutable-",
    },
    {
        title: "createRequire imported from module",
        entry: resolverSyntaxEntry(
            'import { createRequire as factory } from "module";\nconst load = factory(import.meta.url);',
        ),
        applicationId: "com.gtkx.clibundlemodule",
        prefix: "gtkx-bundle-module-",
    },
    {
        title: "createRequire read from a module namespace",
        entry: resolverSyntaxEntry(
            'import * as moduleApi from "node:module";\nconst load = moduleApi.createRequire(import.meta.url);',
        ),
        applicationId: "com.gtkx.clibundlenamespace",
        prefix: "gtkx-bundle-namespace-",
    },
    {
        title: "createRequire read from a required module builtin",
        entry: resolverSyntaxEntry('const load = require("node:module").createRequire(import.meta.url);'),
        applicationId: "com.gtkx.clibundlerequiremember",
        prefix: "gtkx-bundle-require-member-",
    },
];

const scriptNames = (outDir: string): string[] =>
    readdirSync(outDir, { recursive: true, encoding: "utf8" }).filter((name) =>
        SCRIPT_EXTENSIONS.has(extname(name)),
    );

const reactManifest = (): ReactManifest => {
    const manifest = readFileSync(join(WORKSPACE_ROOT, "packages", "react", "package.json"), "utf8");

    return JSON.parse(manifest) as ReactManifest;
};

const versionLiteral = (version: string): RegExp => {
    const escaped = version.split(".").join(String.raw`\.`);

    return new RegExp(String.raw`(["'\x60])${escaped}\1`);
};

const canResolveFromInstall = (installDir: string, specifier: string): boolean => {
    const from = JSON.stringify(join(installDir, BUNDLE_NAME));
    const source = `require("node:module").createRequire(${from}).resolve(${JSON.stringify(specifier)})`;

    const run = spawnSync(process.execPath, ["-e", source], {
        cwd: installDir,
        encoding: "utf8",
        env: deployedEnvironment(),
    });

    return run.status === 0;
};

describe("gtkx build (self-contained bundle)", () => {
    const state: InstalledBundle = {
        project: { root: "", entry: "" },
        installDir: "",
        source: "",
        run: { status: null, stdout: "", stderr: "" },
    };

    beforeAll(async () => {
        state.project = createAppProject({
            applicationId: "com.gtkx.clibundleprobe",
            entry: APP_ENTRY,
            prefix: "gtkx-bundle-probe-",
        });

        await buildAppProject({ project: state.project, outDir: OUT_DIR });
        state.installDir = installBundle(join(state.project.root, OUT_DIR));
        state.source = readFileSync(join(state.installDir, BUNDLE_NAME), "utf8");
        state.run = runNode(join(state.installDir, BUNDLE_NAME));
    }, BUILD_TIMEOUT);

    afterAll(() => {
        removeAppProject(state.project);
        rmSync(state.installDir, { recursive: true, force: true });
    });

    it("starts where node resolves neither the gtkx packages nor their manifests", () => {
        expect(canResolveFromInstall(state.installDir, REACT_PACKAGE)).toBe(false);
        expect(canResolveFromInstall(state.installDir, REACT_MANIFEST)).toBe(false);
        expect(state.run.stderr).not.toContain(MISSING_MODULE);
        expect(state.run.status).toBe(0);
    });

    it("reports the renderer version the react manifest carries, read at build time", () => {
        expect(state.run.stdout.trim()).toBe(`${VERSION_PREFIX}${reactManifest().version}`);
        expect(state.source).toMatch(versionLiteral(reactManifest().version));
        expect(state.source).not.toMatch(/rendererVersion:\s*[\w$]+\(/);
    });
});

describe("gtkx build (worker chunks)", () => {
    it("holds every emitted chunk to the same rule", async () => {
        const project = createAppProject({
            applicationId: "com.gtkx.clibundleworker",
            entry: WORKER_APP_ENTRY,
            files: { [SHARED_SOURCE_PATH]: SHARED_SOURCE, [WORKER_SOURCE_PATH]: WORKER_SOURCE },
            prefix: "gtkx-bundle-worker-",
        });

        try {
            await buildAppProject({ project, outDir: OUT_DIR });
            const emitted = scriptNames(join(project.root, OUT_DIR));
            expect(emitted).toContain(BUNDLE_NAME);
            expect(emitted.filter((name) => name.startsWith(ASSETS_DIR))).toHaveLength(1);
            expect(emitted.filter((name) => name.startsWith(WORKER_DIR))).toHaveLength(1);
            expect(emitted.map((name) => extname(name))).toEqual(emitted.map(() => ESM_EXTENSION));
        } finally {
            removeAppProject(project);
        }
    }, BUILD_TIMEOUT);
});

describe("gtkx build (bundle that would resolve a module at runtime)", () => {
    it.each(RESOLVING_CASES)(
        "fails the build over $title",
        async ({ specifier, applicationId, prefix }) => {
            const project = createAppProject({
                applicationId,
                entry: resolvingEntry(specifier),
                prefix,
            });

            try {
                await expect(buildAppProject({ project, outDir: OUT_DIR })).rejects.toThrow();
            } finally {
                removeAppProject(project);
            }
        },
        BUILD_TIMEOUT,
    );

    it.each(RESOLVER_SYNTAX_CASES)(
        "fails when the bundle uses $title",
        async ({ entry, applicationId, prefix }) => {
            const project = createAppProject({ applicationId, entry, prefix });

            try {
                await expect(buildAppProject({ project, outDir: OUT_DIR })).rejects.toThrow();
            } finally {
                removeAppProject(project);
            }
        },
        BUILD_TIMEOUT,
    );

    it("fails when an unrelated nested binding reuses the resolver name", async () => {
        const project = createAppProject({
            applicationId: "com.gtkx.clibundlescope",
            entry: SCOPED_RESOLVER_ENTRY,
            prefix: "gtkx-bundle-scope-",
        });

        try {
            await expect(buildAppProject({ project, outDir: OUT_DIR })).rejects.toThrow();
        } finally {
            removeAppProject(project);
        }
    }, BUILD_TIMEOUT);

    it("allows a local function that only shares the factory name", async () => {
        const project = createAppProject({
            applicationId: "com.gtkx.clibundlelocalscope",
            entry: LOCAL_FACTORY_ENTRY,
            prefix: "gtkx-bundle-local-scope-",
        });

        try {
            await buildAppProject({ project, outDir: OUT_DIR });
            const run = runNode(join(project.root, OUT_DIR, BUNDLE_NAME));
            expect(run.status).toBe(0);
            expect(run.stdout).toContain(":picomatch");
        } finally {
            removeAppProject(project);
        }
    }, BUILD_TIMEOUT);
});
