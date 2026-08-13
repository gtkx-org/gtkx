import { mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoreOptions } from "../../src/store/store-fs.js";
import { storeUnit } from "./store-unit.js";

type IsolatedProject = {
    root: string;
    gi: StoreOptions;
    jsx: StoreOptions;
};

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const WORKSPACE_PEERS = ["native", "react", "runtime", "utils"];
const REGISTRY_PEERS = ["@types", "csstype", "react"];

const createIsolatedProject = (prefix: string): IsolatedProject => {
    const root = mkdtempSync(join(tmpdir(), prefix));
    const nodeModules = join(root, "node_modules");
    mkdirSync(join(nodeModules, "@gtkx"), { recursive: true });

    for (const name of WORKSPACE_PEERS) {
        symlinkSync(join(REPO_ROOT, "packages", name), join(nodeModules, "@gtkx", name), "dir");
    }

    for (const name of REGISTRY_PEERS) {
        symlinkSync(join(REPO_ROOT, "node_modules", name), join(nodeModules, name), "dir");
    }

    return { root, gi: storeUnit(nodeModules, "gi"), jsx: storeUnit(nodeModules, "jsx") };
};

export { createIsolatedProject };
