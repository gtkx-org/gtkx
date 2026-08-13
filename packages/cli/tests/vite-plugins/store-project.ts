import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

type ProjectRootRef = { root: string };
type StoreName = "gi" | "jsx";

const writePackage = (dir: string, manifest: Record<string, unknown>): void => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify(manifest));
};

const setupProjectRoot = (prefix: string): ProjectRootRef => {
    const ref: ProjectRootRef = { root: "" };

    beforeEach(() => {
        ref.root = mkdtempSync(join(tmpdir(), prefix));
    });

    afterEach(() => {
        rmSync(ref.root, { recursive: true, force: true });
    });

    return ref;
};

const getStoreDir = (root: string, name: StoreName): string => join(root, "node_modules", ".gtkx", name);
const getLinkDir = (root: string, name: StoreName): string => join(root, "node_modules", "@gtkx", name);

const installPackage = (root: string, name: string, manifest: Record<string, unknown> = {}): void => {
    writePackage(join(root, "node_modules", "@gtkx", name), { name: `@gtkx/${name}`, version: "1.0.0", ...manifest });
};

const writeStore = (root: string, name: StoreName, namespaces: string[]): string => {
    const storeDir = getStoreDir(root, name);

    const exports = Object.fromEntries(
        namespaces.map((namespace) => [`./${namespace}`, { default: `./${namespace}/index.js` }]),
    );

    writePackage(storeDir, { name: `@gtkx/${name}`, version: "1.0.0", exports });

    return storeDir;
};

export { getLinkDir, getStoreDir, installPackage, setupProjectRoot, writeStore };
