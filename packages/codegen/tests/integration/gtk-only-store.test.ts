import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { runCodegen } from "../../src/index.js";

const GIR_PATH = ["/usr/share/gir-1.0"];
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const REACT_PACKAGE = join(REPO_ROOT, "packages", "react");

const PEER_PACKAGES: [string, string][] = [
    ["@gtkx/runtime", join(REPO_ROOT, "packages", "runtime")],
    ["react", join(REPO_ROOT, "node_modules", "react")],
    ["@types/react", join(REPO_ROOT, "node_modules", "@types", "react")],
];

const workDir = mkdtempSync(join(tmpdir(), "gtkx-gtk-only-"));
const projectModules = join(workDir, "node_modules");

const isolateProject = (): void => {
    const target = join(projectModules, "@gtkx", "react");
    mkdirSync(dirname(target), { recursive: true });

    cpSync(REACT_PACKAGE, target, {
        recursive: true,
        filter: (source) => !source.split(/[/\\]/).includes("node_modules"),
    });

    symlinkSync(join(REACT_PACKAGE, "node_modules"), join(target, "node_modules"), "dir");

    for (const [name, source] of PEER_PACKAGES) {
        const link = join(projectModules, name);
        mkdirSync(dirname(link), { recursive: true });
        symlinkSync(source, link, "dir");
    }
};

const storeOptions = () => ({
    gi: {
        storeDir: join(projectModules, ".gtkx", "gi"),
        linkDir: join(projectModules, "@gtkx", "gi"),
        version: "0.0.0",
    },
    jsx: {
        storeDir: join(projectModules, ".gtkx", "jsx"),
        linkDir: join(projectModules, "@gtkx", "jsx"),
        version: "0.0.0",
    },
});

const walkEmittedFiles = (directory: string, collected: string[]): void => {
    for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);

        if (entry === "node_modules") {
            continue;
        }

        if (statSync(path).isDirectory()) {
            walkEmittedFiles(path, collected);
            continue;
        }

        collected.push(path);
    }
};

const emittedFiles = (root: string): string[] => {
    const collected: string[] = [];
    walkEmittedFiles(root, collected);

    return collected;
};

const descriptorFor = (source: string, symbol: string): string => {
    const start = source.indexOf(`t.fn("libgtk-4.so.1", "${symbol}"`);

    if (start === -1) {
        throw new Error(`No binding emitted for ${symbol}`);
    }

    return source.slice(start, source.indexOf("});", start));
};

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

describe("a project that declares Gtk-4.0 without Adw-1", () => {
    const { gi, jsx } = storeOptions();

    it("writes and type-checks the whole store", async () => {
        isolateProject();

        const result = await runCodegen({
            libraries: ["Gtk-4.0"],
            girPath: GIR_PATH,
            gi,
            jsx,
            isForced: true,
        });

        expect(result.isRegenerated).toBe(true);
        expect(result.namespaces).toBeGreaterThan(0);
        expect(result.intrinsicElements).toBeGreaterThan(0);
    });

    it("generates no adw namespace in either store", () => {
        expect(readdirSync(gi.storeDir)).not.toContain("adw");
        expect(readdirSync(jsx.storeDir)).not.toContain("adw");
    });

    it("emits no reference to the Adwaita-only react entry point", () => {
        const files = [...emittedFiles(gi.storeDir), ...emittedFiles(jsx.storeDir)];
        expect(files.length).toBeGreaterThan(0);
        const offenders = files.filter((file) => readFileSync(file, "utf8").includes("@gtkx/react/adw"));
        expect(offenders).toEqual([]);
    });

    it("marshals a derived fundamental return through the ref pair it inherits", () => {
        const source = readFileSync(join(gi.storeDir, "gtk", "gtk.js"), "utf8");
        const derived = descriptorFor(source, "gtk_property_expression_new");
        expect(derived).toContain("returns: t.fundamental(");
        expect(derived).toContain("gtk_expression_unref");
        expect(derived).not.toContain("returns: t.object");
        const root = descriptorFor(source, "gtk_bool_filter_get_expression");
        expect(root).toContain("returns: t.fundamental(");
    });
});
