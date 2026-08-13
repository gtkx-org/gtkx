import { cpSync, mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StoreOptions } from "../../src/store/store-fs.js";
import { storeUnit } from "./store-unit.js";

type IsolatedProject = {
    root: string;
    nodeModules: string;
    gi: StoreOptions;
    jsx: StoreOptions;
};

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const REACT_PACKAGE = join(REPO_ROOT, "packages", "react");
const WORKSPACE_PEERS = ["native", "runtime", "utils"];
const REGISTRY_PEERS = ["@types", "csstype", "react"];

const linkPeer = (nodeModules: string, name: string, source: string): void => {
    const link = join(nodeModules, name);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(source, link, "dir");
};

const installReactPackage = (nodeModules: string): void => {
    const target = join(nodeModules, "@gtkx", "react");
    mkdirSync(dirname(target), { recursive: true });

    cpSync(REACT_PACKAGE, target, {
        recursive: true,
        filter: (source) => !source.split(/[/\\]/).includes("node_modules"),
    });

    symlinkSync(join(REACT_PACKAGE, "node_modules"), join(target, "node_modules"), "dir");
};

const isolateProject = (nodeModules: string): void => {
    installReactPackage(nodeModules);

    for (const name of WORKSPACE_PEERS) {
        linkPeer(nodeModules, join("@gtkx", name), join(REPO_ROOT, "packages", name));
    }

    for (const name of REGISTRY_PEERS) {
        linkPeer(nodeModules, name, join(REPO_ROOT, "node_modules", name));
    }
};

const createIsolatedProject = (prefix: string): IsolatedProject => {
    const root = mkdtempSync(join(tmpdir(), prefix));
    const nodeModules = join(root, "node_modules");
    isolateProject(nodeModules);

    return { root, nodeModules, gi: storeUnit(nodeModules, "gi"), jsx: storeUnit(nodeModules, "jsx") };
};

export { createIsolatedProject, isolateProject };
