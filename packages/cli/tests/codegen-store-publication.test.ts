import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmSync,
    symlinkSync,
    utimesSync,
    writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, runCliOrThrow, startCli } from "./cli-project.js";
import { fixtureLibrariesConfig } from "./codegen-helpers.js";

const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const CODEGEN_ENTRY = new URL("../../codegen/dist/index.js", import.meta.url).href;
const FIXTURE_GIR = fileURLToPath(new URL("fixtures/gir", import.meta.url));
const COMMON_PROBE = `import type * as Gtk from "@gtkx/gi/gtk";
import type * as GtkJsx from "@gtkx/jsx/gtk";

export type Generated = [keyof typeof Gtk, keyof typeof GtkJsx];
`;
const HOOK_SLOTS_PROBE = `import type * as HookSlots from "@gtkx/gi/hookslots";

export type Generated = keyof typeof HookSlots;
`;
const TSCONFIG = `${JSON.stringify({
    compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: "ESNext",
    },
    files: ["probe.ts"],
}, null, 4)}\n`;
const LOCK_WAIT_MS = 10_000;
const IMPORT_PROBE = 'await Promise.all([import("@gtkx/gi/gobject"), import("@gtkx/jsx/metadata")]);';
const TRANSITION_IMPORT_PROBE = `import { createRequire } from "node:module";
const resolve = createRequire(import.meta.url).resolve;
const canResolve = (specifier) => {
    try {
        resolve(specifier);
        return true;
    } catch {
        return false;
    }
};
const previous = ["@gtkx/gi/documented", "@gtkx/jsx/documented"].every(canResolve);
const next = ["@gtkx/gi/hookslots", "@gtkx/jsx/hookslots"].every(canResolve);
if (previous === next) process.exitCode = 1;
`;
const LOCK_TIMEOUT_ENV = { GTKX_CODEGEN_LOCK_TIMEOUT_MS: "250" };
const REUSED_PID_IDENTITY = "0".repeat(64);
const ZOMBIE_OWNER_SCRIPT = `import { spawn } from "node:child_process";
import { writeSync } from "node:fs";
const child = spawn(process.execPath, ["--eval", ""], { stdio: "ignore" });
writeSync(1, String(child.pid) + String.fromCharCode(10));
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120_000);
`;

const abandonedGenerationName = (prefix: string, index: number): string => {
    const timestamp = String(Date.now());
    const pid = String(process.pid);

    return `${prefix}-${timestamp}-${pid}-${REUSED_PID_IDENTITY}-${String(index)}`;
};
const INTERLEAVED_OWNER_PROBE = `import {
    resolveGirPath,
    resolveStore,
    runCodegen,
} from ${JSON.stringify(CODEGEN_ENTRY)};
const [firstRoot, secondRoot, girPath] = process.argv.slice(1);
const first = resolveStore(firstRoot);
resolveStore(secondRoot);
await runCodegen({
    gi: first.gi,
    jsx: first.jsx ?? undefined,
    libraries: ["Documented-1.0"],
    girPath: resolveGirPath([girPath]),
});
`;

const delay = async (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

const processState = (pid: number): string | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");

        return stat.slice(stat.lastIndexOf(") ") + 2).split(" ", 1)[0];
    } catch {
        return undefined;
    }
};

const waitForZombie = async (pid: number): Promise<void> => {
    const deadline = Date.now() + LOCK_WAIT_MS;

    while (Date.now() < deadline && processState(pid) !== "Z") {
        await delay();
    }

    if (processState(pid) !== "Z") {
        throw new Error("process did not become a zombie");
    }
};

const startZombieOwner = async (): Promise<{ parent: ChildProcess; pid: number }> => {
    const parent = spawn(
        process.execPath,
        ["--input-type=module", "--eval", ZOMBIE_OWNER_SCRIPT],
        { stdio: ["ignore", "pipe", "ignore"] },
    );
    const stdout = parent.stdout;

    const pid = await new Promise<number>((resolve, reject) => {
        let value = "";

        stdout.on("data", (chunk: Buffer) => {
            value += chunk.toString();

            if (value.includes("\n")) {
                resolve(Number(value.trim()));
            }
        });
        parent.once("error", reject);
        parent.once("exit", () => {
            reject(new Error("zombie owner exited before reporting its child pid"));
        });
    });
    await waitForZombie(pid);

    return { parent, pid };
};

const exited = (child: ChildProcess): Promise<number | null> =>
    new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => {
            resolve(code);
        });
    });

const runTypecheck = (project: CliProject): number | null =>
    spawnSync(process.execPath, [TYPESCRIPT_CLI, "--project", "tsconfig.json"], {
        cwd: project.root,
        timeout: 60_000,
    }).status;

const runImportProbe = (project: CliProject, source: string): number | null =>
    spawnSync(
        process.execPath,
        ["--conditions=source", "--import=tsx", "--input-type=module", "--eval", source],
        { cwd: project.root, timeout: 60_000 },
    ).status;

const runImport = (project: CliProject): number | null => runImportProbe(project, IMPORT_PROBE);

const runTransitionImport = (project: CliProject): number | null =>
    runImportProbe(project, TRANSITION_IMPORT_PROBE);

const runInterleavedOwners = (first: CliProject, second: CliProject): number | null =>
    spawnSync(
        process.execPath,
        ["--input-type=module", "--eval", INTERLEAVED_OWNER_PROBE, first.root, second.root, FIXTURE_GIR],
        { cwd: first.root, timeout: 60_000 },
    ).status;

const storeLock = (project: CliProject): string => join(project.nodeModules, ".gtkx", ".codegen.lock");

const readStoreLock = (project: CliProject): string | null => {
    try {
        return readFileSync(storeLock(project), "utf8");
    } catch {
        return null;
    }
};

const waitForLock = async (project: CliProject, previous: string | null): Promise<void> => {
    const lock = storeLock(project);
    const deadline = Date.now() + LOCK_WAIT_MS;

    while (Date.now() < deadline) {
        if (existsSync(lock) && readStoreLock(project) !== previous) {
            return;
        }

        await delay();
    }

    throw new Error("codegen did not acquire its generated-store lock");
};

const writeConfig = (project: CliProject, source: string): void => {
    writeFileSync(join(project.root, "gtkx.config.ts"), source);
};

const pairGenerationCount = (project: CliProject): number =>
    readdirSync(join(project.nodeModules, ".gtkx"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(".pair-generation-"))
        .length;

const detachedGenerationCount = (project: CliProject, store: string): number =>
    readdirSync(join(project.nodeModules, ".gtkx"), { withFileTypes: true })
        .filter((entry) =>
            entry.isDirectory() &&
            (entry.name.startsWith(`.${store}-generation-`) || entry.name.startsWith(`.${store}-legacy-`)))
        .length;

const seedStoreArtifacts = (project: CliProject, store: string): void => {
    for (const kind of ["generation", "legacy"]) {
        for (let index = 0; index < 6; index += 1) {
            const name = abandonedGenerationName(`.${store}-${kind}`, index);
            mkdirSync(join(project.nodeModules, ".gtkx", name));
        }
    }
};

const seedDetachedGenerations = (project: CliProject): void => {
    for (const store of ["gi", "jsx"]) {
        seedStoreArtifacts(project, store);
    }

    for (let index = 0; index < 6; index += 1) {
        const name = abandonedGenerationName(".pair-generation", index);
        mkdirSync(join(project.nodeModules, ".gtkx", name));
    }
};

const seedZombieGenerations = (project: CliProject, pid: number): void => {
    for (let index = 0; index < 6; index += 1) {
        const name = `.pair-generation-${String(Date.now())}-${String(pid)}-unknown-${String(index)}`;
        mkdirSync(join(project.nodeModules, ".gtkx", name));
    }
};

const seedLiveGiOnlyArtifacts = (project: CliProject): string[] => {
    const root = join(project.nodeModules, ".gtkx");
    const timestamp = String(Date.now());
    const owner = `${String(process.pid)}-unknown-live`;
    const paths = [
        join(root, `.pair-generation-${timestamp}-${owner}`),
        join(root, `.jsx-generation-${timestamp}-${owner}`),
    ];
    const old = new Date(0);

    for (const path of paths) {
        mkdirSync(path);
        utimesSync(path, old, old);
    }

    return paths;
};

const pairDirectories = (project: CliProject): string[] => {
    const root = join(project.nodeModules, ".gtkx");

    return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name.startsWith(".pair-generation-"))
        .map((entry) => join(root, entry.name));
};

const convertToDirectStoreLayout = (project: CliProject): void => {
    const root = join(project.nodeModules, ".gtkx");
    const directGi = join(root, "direct-gi");
    const directJsx = join(root, "direct-jsx");
    cpSync(realpathSync(join(root, "gi")), directGi, { recursive: true });
    cpSync(realpathSync(join(root, "jsx")), directJsx, { recursive: true });
    rmSync(join(directJsx, "node_modules"), { recursive: true, force: true });
    rmSync(join(root, "gi"), { force: true });
    rmSync(join(root, "jsx"), { force: true });
    rmSync(join(root, "current"), { force: true });

    for (const pair of pairDirectories(project)) {
        rmSync(pair, { recursive: true, force: true });
    }

    renameSync(directGi, join(root, "gi"));
    renameSync(directJsx, join(root, "jsx"));
};

const retainedPairDirectory = (project: CliProject): string => {
    const root = join(project.nodeModules, ".gtkx");
    const current = realpathSync(join(root, "current"));
    const retained = pairDirectories(project).find((pair) => pair !== current);

    if (retained === undefined) {
        throw new Error("codegen did not retain the previous generated-store pair");
    }

    return retained;
};

const sharedProject = (host: CliProject, name: string, source: string): CliProject => {
    const root = join(host.root, name);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "package.json"), `${JSON.stringify({ name, private: true, type: "module" }, null, 4)}\n`);
    writeFileSync(join(root, "gtkx.config.ts"), source);

    return { root, nodeModules: host.nodeModules };
};

describe("gtkx codegen store publication", () => {
    it("keeps imports complete while concurrent writers publish a new store", async () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-publish-",
            config: fixtureLibrariesConfig(["Documented-1.0"]),
            files: { "probe.ts": COMMON_PROBE, "tsconfig.json": TSCONFIG },
        });
        runCliOrThrow(project, ["codegen"]);
        expect(runTransitionImport(project)).toBe(0);
        const zombie = await startZombieOwner();

        try {
            seedDetachedGenerations(project);
            seedZombieGenerations(project, zombie.pid);
            runCliOrThrow(project, ["codegen"]);
            expect(pairGenerationCount(project)).toBeLessThanOrEqual(3);
            expect(detachedGenerationCount(project, "gi")).toBeLessThanOrEqual(3);
            expect(detachedGenerationCount(project, "jsx")).toBeLessThanOrEqual(3);
        } finally {
            const zombieExit = exited(zombie.parent);
            zombie.parent.kill("SIGKILL");
            await zombieExit;
        }

        writeConfig(project, fixtureLibrariesConfig(["HookSlots-1.0"]));
        const children = Array.from({ length: 4 }, () => startCli(project, ["codegen", "--force"]));
        const exits = children.map((child) => exited(child));

        do {
            expect(runTypecheck(project)).toBe(0);
            expect(runImport(project)).toBe(0);
            expect(runTransitionImport(project)).toBe(0);
            await delay();
        } while (children.some((child) => child.exitCode === null && child.signalCode === null));

        expect(await Promise.all(exits)).toEqual([0, 0, 0, 0]);
        writeFileSync(join(project.root, "probe.ts"), HOOK_SLOTS_PROBE);
        expect(runTypecheck(project)).toBe(0);
        expect(runTransitionImport(project)).toBe(0);
        expect(pairGenerationCount(project)).toBeLessThanOrEqual(3);
        expect(detachedGenerationCount(project, "gi")).toBeLessThanOrEqual(3);
        expect(detachedGenerationCount(project, "jsx")).toBeLessThanOrEqual(3);
    });

    it("recovers after a writer exits while owning the store", async () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-stale-writer-",
            config: fixtureLibrariesConfig(["HookSlots-1.0"]),
            files: { "probe.ts": COMMON_PROBE, "tsconfig.json": TSCONFIG },
        });
        runCliOrThrow(project, ["codegen"]);
        expect(readStoreLock(project)).toBeNull();
        const previous = readStoreLock(project);
        const child = startCli(project, ["codegen", "--force"]);
        const exit = exited(child);
        await waitForLock(project, previous);
        child.kill("SIGKILL");
        await exit;
        expect(readStoreLock(project)).not.toBeNull();
        const lock = storeLock(project);
        const expiredLiveOwner = { createdAt: 0, identity: null, pid: process.pid, token: "reused" };
        writeFileSync(lock, JSON.stringify(expiredLiveOwner));

        runCliOrThrow(project, ["codegen", "--force"]);
        expect(readStoreLock(project)).toBeNull();
        expect(runTypecheck(project)).toBe(0);
        expect(runImport(project)).toBe(0);
    });

    it("reclaims stale pair and JSX artifacts after switching to GI-only codegen", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-gi-only-",
            config: fixtureLibrariesConfig(["Documented-1.0"]),
            files: { "probe.ts": COMMON_PROBE, "tsconfig.json": TSCONFIG },
        });
        runCliOrThrow(project, ["codegen"]);
        const liveArtifacts = seedLiveGiOnlyArtifacts(project);

        for (let index = 0; index < 6; index += 1) {
            const pair = abandonedGenerationName(".pair-generation", index);
            const jsx = abandonedGenerationName(".jsx-generation", index);
            mkdirSync(join(project.nodeModules, ".gtkx", pair));
            mkdirSync(join(project.nodeModules, ".gtkx", jsx));
        }

        rmSync(join(project.nodeModules, "@gtkx", "react"), { recursive: true, force: true });
        runCliOrThrow(project, ["codegen", "--force"]);

        expect(liveArtifacts.every((path) => existsSync(path))).toBe(true);
        expect(pairGenerationCount(project)).toBeLessThanOrEqual(4);
        expect(detachedGenerationCount(project, "jsx")).toBeLessThanOrEqual(4);
        expect(runTypecheck(project)).toBe(0);
        expect(runImport(project)).toBe(0);
    });

    it("keeps a retained JSX generation bound to its matching GI", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-retained-pair-",
            config: fixtureLibrariesConfig(["Documented-1.0"]),
        });
        runCliOrThrow(project, ["codegen"]);
        const resolveFromProject = createRequire(join(project.root, "probe.js"));
        const oldJsx = resolveFromProject.resolve("@gtkx/jsx/documented");
        writeConfig(project, fixtureLibrariesConfig(["HookSlots-1.0"]));

        runCliOrThrow(project, ["codegen", "--force"]);
        const oldGi = createRequire(oldJsx).resolve("@gtkx/gi/documented");
        expect(existsSync(oldGi)).toBe(true);
    });

    it("pins a migrated direct-layout JSX store to its matching GI", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-migrated-pair-",
            config: fixtureLibrariesConfig(["Documented-1.0"]),
        });
        runCliOrThrow(project, ["codegen"]);
        convertToDirectStoreLayout(project);
        writeConfig(project, fixtureLibrariesConfig(["HookSlots-1.0"]));

        runCliOrThrow(project, ["codegen", "--force"]);
        const oldJsx = join(retainedPairDirectory(project), "jsx", "documented", "index.js");
        const oldGi = createRequire(oldJsx).resolve("@gtkx/gi/documented");
        expect(existsSync(oldGi)).toBe(true);
    });

    it("stops waiting after the active-writer timeout", async () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-expired-writer-",
            config: fixtureLibrariesConfig(["HookSlots-1.0"]),
        });
        runCliOrThrow(project, ["codegen"]);
        const previous = readStoreLock(project);
        const child = startCli(project, ["codegen", "--force"]);
        const exit = exited(child);
        await waitForLock(project, previous);
        child.kill("SIGSTOP");

        try {
            expect(() => runCliOrThrow(project, ["codegen", "--force"], LOCK_TIMEOUT_ENV)).toThrow();
        } finally {
            child.kill("SIGKILL");
            await exit;
        }
    });

    it("rejects a generated-store lock symlink", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-lock-symlink-",
            config: fixtureLibrariesConfig(["HookSlots-1.0"]),
        });
        mkdirSync(join(project.nodeModules, ".gtkx"), { recursive: true });
        const target = join(project.root, "lock-target");
        writeFileSync(target, "preserve");
        symlinkSync(target, storeLock(project));

        expect(() => runCliOrThrow(project, ["codegen"])).toThrow();
    });

    it("rejects incompatible projects sharing one generated store", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-shared-store-",
            config: fixtureLibrariesConfig(["Documented-1.0"]),
        });
        runCliOrThrow(project, ["codegen"]);
        const compatible = sharedProject(project, "compatible", fixtureLibrariesConfig(["Documented-1.0"]));
        const incompatible = sharedProject(project, "incompatible", fixtureLibrariesConfig(["HookSlots-1.0"]));

        runCliOrThrow(compatible, ["codegen", "--force"]);
        expect(() => runCliOrThrow(incompatible, ["codegen"])).toThrow();
    });

    it("keeps ownership attached across interleaved store resolutions", () => {
        using project = createCliProject({ prefix: "gtkx-cli-codegen-interleaved-owner-" });
        const first = sharedProject(project, "first", fixtureLibrariesConfig(["Documented-1.0"]));
        const second = sharedProject(project, "second", fixtureLibrariesConfig(["HookSlots-1.0"]));

        expect(runInterleavedOwners(first, second)).toBe(0);
        expect(() => runCliOrThrow(second, ["codegen"])).toThrow();
    });
});
