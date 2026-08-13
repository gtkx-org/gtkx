import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readlinkSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ensureStoreLinks } from "../../src/store/store-links.js";

type Project = { root: string; nodeModules: string };

const roots: string[] = [];

const writePackage = (dir: string, manifest: Record<string, unknown>): void => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
};

const getStoreDir = (nodeModules: string, name: "gi" | "jsx"): string => join(nodeModules, ".gtkx", name);
const getLinkDir = (nodeModules: string, name: "gi" | "jsx"): string => join(nodeModules, "@gtkx", name);

const writeStore = (nodeModules: string, name: "gi" | "jsx"): string => {
    const storeDir = getStoreDir(nodeModules, name);
    writePackage(storeDir, { name: `@gtkx/${name}`, version: "0.0.0", exports: {} });
    writeFileSync(join(storeDir, "generated.js"), "export const generated = true;\n");

    return storeDir;
};

const createProject = (hasReact = true): Project => {
    const root = mkdtempSync(join(tmpdir(), "gtkx-store-links-"));
    roots.push(root);
    const nodeModules = join(root, "node_modules");
    writePackage(join(nodeModules, "@gtkx", "runtime"), { name: "@gtkx/runtime", version: "1.0.0" });

    if (hasReact) {
        writePackage(join(nodeModules, "@gtkx", "react"), { name: "@gtkx/react", version: "1.0.0", exports: {} });
    }

    return { root, nodeModules };
};

const isLinkedTo = (linkDir: string, storeDir: string): boolean =>
    existsSync(linkDir) && realpathSync(linkDir) === realpathSync(storeDir);

const createGiProject = (): Project & { gi: string } => {
    const project = createProject(false);

    return { ...project, gi: writeStore(project.nodeModules, "gi") };
};

afterAll(() => {
    for (const root of roots) {
        rmSync(root, { recursive: true, force: true });
    }
});

describe("ensureStoreLinks — a pruned link", () => {
    it("comes back for both stores, from what is left on disk", () => {
        const { root, nodeModules } = createProject();
        const gi = writeStore(nodeModules, "gi");
        const jsx = writeStore(nodeModules, "jsx");
        ensureStoreLinks(root);
        expect(isLinkedTo(getLinkDir(nodeModules, "gi"), gi)).toBe(true);
        expect(isLinkedTo(getLinkDir(nodeModules, "jsx"), jsx)).toBe(true);
    });

    it("comes back pointing at the store relatively", () => {
        const { root, nodeModules } = createGiProject();
        ensureStoreLinks(root);
        expect(readlinkSync(getLinkDir(nodeModules, "gi"))).toBe(join("..", ".gtkx", "gi"));
    });

    it("is replaced when an install left it pointing somewhere else", () => {
        const { root, nodeModules, gi } = createGiProject();
        const stray = join(nodeModules, "stray");
        mkdirSync(stray, { recursive: true });
        const linkDir = getLinkDir(nodeModules, "gi");
        mkdirSync(dirname(linkDir), { recursive: true });
        symlinkSync(stray, linkDir, "dir");
        ensureStoreLinks(root);
        expect(isLinkedTo(linkDir, gi)).toBe(true);
    });
});

describe("ensureStoreLinks — a store that needs no link", () => {
    it("is left alone when its link already points at it", () => {
        const { root, nodeModules, gi } = createGiProject();
        ensureStoreLinks(root);
        const linkDir = getLinkDir(nodeModules, "gi");
        const before = realpathSync(linkDir);
        ensureStoreLinks(root);
        expect(realpathSync(linkDir)).toBe(before);
        expect(isLinkedTo(linkDir, gi)).toBe(true);
    });

    it("gets no link when it was never generated", () => {
        const { root, nodeModules } = createProject();
        ensureStoreLinks(root);
        expect(existsSync(getLinkDir(nodeModules, "gi"))).toBe(false);
        expect(existsSync(getLinkDir(nodeModules, "jsx"))).toBe(false);
    });

    it("gets no jsx link when the project has no React", () => {
        const { root, nodeModules } = createGiProject();
        writeStore(nodeModules, "jsx");
        ensureStoreLinks(root);
        expect(existsSync(getLinkDir(nodeModules, "gi"))).toBe(true);
        expect(existsSync(getLinkDir(nodeModules, "jsx"))).toBe(false);
    });

    it("is not looked for at all without a @gtkx/runtime to anchor it", () => {
        const root = mkdtempSync(join(tmpdir(), "gtkx-store-links-bare-"));
        roots.push(root);

        expect(() => {
            ensureStoreLinks(root);
        }).not.toThrow();

        expect(existsSync(join(root, "node_modules", "@gtkx"))).toBe(false);
    });
});
