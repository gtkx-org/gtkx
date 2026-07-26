import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveGirPath, resolveLibraries } from "@gtkx/codegen";
import type { Config } from "@gtkx/config";
import { type CodegenStore, resolveCodegenStore } from "./store-resolver.js";

export type CodegenInputs = {
    girPath: string[];
    libraries: string[];
    store: CodegenStore;
};

export const resolveCodegenInputs = (cwd: string, config: Config): CodegenInputs => {
    const girPath = resolveGirPath(config.girPath);
    const libraries = resolveLibraries(config.libraries, girPath);
    const store = resolveCodegenStore(cwd);
    return { girPath, libraries, store };
};

const REACT_GENERATED_MODULES: string[] = ["metadata.js", join("gtk", "gtk.js")];

const namespaceBarrelPath = (giStoreDir: string, library: string): string => {
    const separator = library.indexOf("-");
    const namespace = (separator === -1 ? library : library.slice(0, separator)).toLowerCase();
    return join(giStoreDir, namespace, "index.js");
};

const giStoreLinksResolve = (giStoreDir: string): boolean =>
    existsSync(join(giStoreDir, "node_modules", "@gtkx", "gi", "package.json"));

const giStoreStale = (store: CodegenStore, libraries: string[]): boolean => {
    if (!existsSync(store.giLinkDir) || !existsSync(store.giStoreDir)) return true;
    if (!giStoreLinksResolve(store.giStoreDir)) return true;
    return libraries.some((library) => !existsSync(namespaceBarrelPath(store.giStoreDir, library)));
};

const reactStoreStale = (store: CodegenStore): boolean => {
    if (store.react === null) return false;
    if (!existsSync(store.jsxLinkDir)) return true;
    return REACT_GENERATED_MODULES.some((module) => !existsSync(join(store.jsxStoreDir, module)));
};

export const isCodegenStale = (inputs: CodegenInputs): boolean => {
    try {
        return giStoreStale(inputs.store, inputs.libraries) || reactStoreStale(inputs.store);
    } catch {
        return true;
    }
};
