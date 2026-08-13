import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ensureStoreLinks, runCodegen } from "../../src/index.js";
import { FIXTURE_GIR_PATH, GIR_PATH } from "../helpers/gir-path.js";
import { createIsolatedProject } from "../helpers/isolated-project.js";
import { runningStagingName, strandedStagingName } from "../helpers/staging.js";
import { storeUnit } from "../helpers/store-unit.js";

const FINGERPRINT_FILE = ".codegen-fingerprint.json";
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const workDir = mkdtempSync(join(REPO_ROOT, "node_modules", ".gtkx-test-"));
const isolatedRoots: string[] = [];

const projectModules = (name: string): string => join(workDir, name, "node_modules");

const expectMappableNamespace = (storeDir: string): void => {
    const { exports } = JSON.parse(readFileSync(join(storeDir, "package.json"), "utf8")) as {
        exports: Record<string, unknown>;
    };

    expect(exports["./gtk"]).toEqual({ types: "./gtk/index.d.ts", default: "./gtk/index.js" });
    expect(existsSync(join(storeDir, "gtk", "index.js"))).toBe(true);
    expect(existsSync(join(storeDir, "gtk", "index.d.ts"))).toBe(true);
};

const registerStoreWriteTests = (): void => {
    it("writes the gi store with raw modules, barrels, a package.json and the visible alias", async () => {
        const gi = storeUnit(projectModules("gi-only"), "gi");

        const result = await runCodegen({
            libraries: ["GObject-2.0"],
            girPath: GIR_PATH,
            gi,
        });

        expect(result.namespaces).toBeGreaterThan(0);
        expect(result.intrinsicElements).toBe(0);
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(existsSync(join(gi.storeDir, "gobject", "gobject.js"))).toBe(true);
        expect(existsSync(join(gi.storeDir, "gobject", "gobject.d.ts"))).toBe(true);
        expect(existsSync(join(gi.storeDir, "gobject", "index.js"))).toBe(true);
        expect(existsSync(join(gi.storeDir, "package.json"))).toBe(true);
        expect(existsSync(join(gi.storeDir, ".codegen-fingerprint.json"))).toBe(true);
        expect(existsSync(gi.linkDir)).toBe(true);
    });

    it("writes the jsx unit when jsx options are given", async () => {
        const nodeModules = projectModules("with-jsx");
        const gi = storeUnit(nodeModules, "gi");
        const jsx = storeUnit(nodeModules, "jsx");
        const options = { libraries: ["Gtk-4.0"], girPath: GIR_PATH, gi, jsx };
        const result = await runCodegen(options);
        expect(result.intrinsicElements).toBeGreaterThan(0);
        expect(existsSync(join(gi.storeDir, "gtk", "gtk.js"))).toBe(true);
        expect(readFileSync(join(jsx.storeDir, "gtk", "gtk.js"), "utf8").length).toBeGreaterThan(0);
        expect(readFileSync(join(jsx.storeDir, "metadata.js"), "utf8").length).toBeGreaterThan(0);
        expect(existsSync(jsx.linkDir)).toBe(true);
        expectMappableNamespace(gi.storeDir);
        expectMappableNamespace(jsx.storeDir);
    });
};

const registerShadowedMemberTests = (): void => {
    it("writes a store whose interface members shadow what GObject.Object declares", async () => {
        const gi = storeUnit(projectModules("shadowed-members"), "gi");
        const result = await runCodegen({ libraries: ["Clash-1.0"], girPath: FIXTURE_GIR_PATH, gi });
        expect(result.namespaces).toBeGreaterThan(0);
        const types = readFileSync(join(gi.storeDir, "clash", "clash.d.ts"), "utf8");
        expect(types).toContain("export interface Serial extends Omit<GObject.Object, \"getProperty\"> {");
        expect(existsSync(join(gi.storeDir, "clash", "clash.js"))).toBe(true);
    });
};

const generateAccessorStore = async (name: string): Promise<{ types: string; code: string }> => {
    const gi = storeUnit(projectModules(name), "gi");
    const result = await runCodegen({ libraries: ["Accessor-1.0"], girPath: FIXTURE_GIR_PATH, gi });
    expect(result.namespaces).toBeGreaterThan(0);

    return {
        types: readFileSync(join(gi.storeDir, "accessor", "accessor.d.ts"), "utf8"),
        code: readFileSync(join(gi.storeDir, "accessor", "accessor.js"), "utf8"),
    };
};

const classBody = (source: string, head: string): string => {
    const start = source.indexOf(head);
    expect(start, `expected ${head} in the generated store`).toBeGreaterThan(-1);

    return source.slice(start, source.indexOf("\n}", start));
};

const registerPropertyAccessorTests = (): void => {
    it("writes a store whose property accessors read and write different types", async () => {
        const { types } = await generateAccessorStore("accessor-types");
        const panel = classBody(types, "export declare class Panel");
        expect(panel).toContain("get caption(): string | null;\n    set caption(value: string);");
        expect(panel).toContain("get title(): string;\n    set title(value: string | null);");
        expect(panel).toContain("get tags(): string[];\n    set tags(value: string[] | null);");
    });

    it("keeps a redeclared property assignable to every base type that declares it", async () => {
        const { types, code } = await generateAccessorStore("accessor-bases");

        expect(classBody(types, "export declare class Dock")).toContain(
            "get badge(): string;\n    set badge(value: string);\n" +
            "    get motto(): string;\n    set motto(value: string | null);",
        );

        expect(classBody(code, "export class Dock")).toContain(
            'get badge() {\n        return getObjectProperty(this, "badge", t.string("borrowed"));',
        );

        expect(classBody(types, "export declare class Node")).toContain(
            "get tag(): string;\n    set tag(value: string);\n    set token(value: string);",
        );

        expect(classBody(code, "export class Node")).toContain(
            'get tag() {\n        return getObjectProperty(this, "tag", t.string("borrowed"));',
        );

        expect(classBody(code, "export class Node")).toContain("set token(value) {\n        this.setToken(value);");
    });
};

const registerFreshnessTests = (): void => {
    it("skips regeneration when the store fingerprint is still fresh", async () => {
        const gi = storeUnit(projectModules("rerun"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        const first = await runCodegen(options);
        expect(first.isRegenerated).toBe(true);
        const second = await runCodegen(options);
        expect(second.isRegenerated).toBe(false);
        expect(second.namespaces).toBe(0);
    });

    it("regenerates when forced", async () => {
        const gi = storeUnit(projectModules("forced"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        await runCodegen(options);
        const result = await runCodegen({ ...options, isForced: true });
        expect(result.isRegenerated).toBe(true);
        expect(result.namespaces).toBeGreaterThan(0);
        expect(existsSync(join(gi.storeDir, "glib", "glib.js"))).toBe(true);
    });

    it("regenerates when the fingerprint no longer matches", async () => {
        const gi = storeUnit(projectModules("stale-fp"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        await runCodegen(options);

        writeFileSync(
            join(gi.storeDir, FINGERPRINT_FILE),
            JSON.stringify({ value: "stale", girFiles: [], libraries: ["GLib-2.0"] }),
        );

        const rerun = await runCodegen(options);
        expect(rerun.isRegenerated).toBe(true);
    });
};

const registerStagingTests = (): void => {
    it("removes what a killed run stranded and keeps what a running one staged", async () => {
        const gi = storeUnit(projectModules("stranded"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        await runCodegen(options);
        const stranded = strandedStagingName(gi.storeDir);
        const running = runningStagingName(gi.storeDir);
        mkdirSync(stranded, { recursive: true });
        mkdirSync(running, { recursive: true });
        const rerun = await runCodegen(options);
        expect(rerun.isRegenerated).toBe(false);
        expect(existsSync(stranded)).toBe(false);
        expect(existsSync(running)).toBe(true);
    });

    it("runs on when a stranded staging directory cannot be removed", async () => {
        const gi = storeUnit(projectModules("unsweepable"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        await runCodegen(options);
        const storeParent = dirname(gi.storeDir);
        mkdirSync(strandedStagingName(gi.storeDir), { recursive: true });
        chmodSync(storeParent, 0o555);

        try {
            const rerun = await runCodegen(options);
            expect(rerun.isRegenerated).toBe(false);
        } finally {
            chmodSync(storeParent, 0o755);
        }
    });
};

const registerStoreLinkTests = (): void => {
    it("restores a link an install pruned without regenerating the store", async () => {
        const gi = storeUnit(projectModules("pruned-link"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        await runCodegen(options);
        rmSync(gi.linkDir, { recursive: true, force: true });
        const rerun = await runCodegen(options);
        expect(rerun.isRegenerated).toBe(false);
        expect(existsSync(join(gi.linkDir, "glib", "glib.js"))).toBe(true);
    });

    it("keeps the restored link when the run fails before it writes anything", async () => {
        const gi = storeUnit(projectModules("failed-relink"), "gi");
        const options = { libraries: ["GLib-2.0"], girPath: GIR_PATH, gi };
        await runCodegen(options);
        rmSync(gi.linkDir, { recursive: true, force: true });
        await expect(runCodegen({ ...options, libraries: ["Absent-1.0"] })).rejects.toThrow("Absent-1.0.gir");
        expect(existsSync(join(gi.linkDir, "glib", "glib.js"))).toBe(true);
    });

    it("restores a pruned link from the project root alone, without running codegen", async () => {
        const { root, gi } = createIsolatedProject("gtkx-relink-project-");
        isolatedRoots.push(root);
        await runCodegen({ libraries: ["GLib-2.0"], girPath: GIR_PATH, gi });
        rmSync(gi.linkDir, { recursive: true, force: true });
        ensureStoreLinks(root);
        expect(existsSync(join(gi.linkDir, "glib", "index.js"))).toBe(true);
    });

    it("restores the pruned gi link before the stale jsx store is type checked", async () => {
        const { root, gi, jsx } = createIsolatedProject("gtkx-pruned-link-jsx-");
        isolatedRoots.push(root);
        const options = { libraries: ["Gtk-4.0"], girPath: GIR_PATH, gi, jsx };
        await runCodegen(options);
        writeFileSync(join(jsx.storeDir, FINGERPRINT_FILE), JSON.stringify({ value: "stale" }));
        rmSync(gi.linkDir, { recursive: true, force: true });
        rmSync(jsx.linkDir, { recursive: true, force: true });
        const rerun = await runCodegen(options);
        expect(rerun.isRegenerated).toBe(true);
        expect(rerun.namespaces).toBe(0);
        expect(existsSync(join(gi.linkDir, "gtk", "gtk.js"))).toBe(true);
        expect(existsSync(join(jsx.linkDir, "gtk", "gtk.js"))).toBe(true);
    });
};

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });

    for (const root of isolatedRoots) {
        rmSync(root, { recursive: true, force: true });
    }
});

describe("runCodegen", () => {
    registerStoreWriteTests();
    registerShadowedMemberTests();
    registerPropertyAccessorTests();
    registerFreshnessTests();
    registerStagingTests();
    registerStoreLinkTests();
});
