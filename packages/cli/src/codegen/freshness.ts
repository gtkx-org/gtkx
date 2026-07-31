import type { Config } from "@gtkx/config";
import { resolveGirPath, resolveLibraries } from "@gtkx/codegen";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { type CodegenStore, resolveCodegenStore } from "./store-resolver.js";

type CodegenInputs = {
    girPath: string[];
    libraries: string[];
    store: CodegenStore;
};

const REACT_GENERATED_MODULES: string[] = ["metadata.js", join("gtk", "gtk.js")];

const resolveCodegenInputs = (cwd: string, config: Config): CodegenInputs => {
    const girPath = resolveGirPath(config.girPath);
    const libraries = resolveLibraries(config.libraries, girPath);
    const store = resolveCodegenStore(cwd);

    return { girPath, libraries, store };
};

const namespaceBarrelPath = (giStoreDir: string, library: string): string => {
    const separator = library.indexOf("-");
    const namespace = (separator === -1 ? library : library.slice(0, separator)).toLowerCase();

    return join(giStoreDir, namespace, "index.js");
};

const isStoreResolvable = (storeDir: string, packageName: string): boolean =>
    existsSync(join(storeDir, "node_modules", "@gtkx", packageName, "package.json"));

const isGiStoreStale = (store: CodegenStore, libraries: string[]): boolean => {
    if (!existsSync(store.giLinkDir) || !existsSync(store.giStoreDir)) {
        return true;
    }

    if (!isStoreResolvable(store.giStoreDir, "gi")) {
        return true;
    }

    return libraries.some((library) => !existsSync(namespaceBarrelPath(store.giStoreDir, library)));
};

const isReactStoreStale = (store: CodegenStore): boolean => {
    if (store.react === null) {
        return false;
    }

    if (!existsSync(store.jsxLinkDir) || !isStoreResolvable(store.jsxStoreDir, "jsx")) {
        return true;
    }

    return REACT_GENERATED_MODULES.some((module) => !existsSync(join(store.jsxStoreDir, module)));
};

const isCodegenStale = (inputs: CodegenInputs): boolean => {
    try {
        return isGiStoreStale(inputs.store, inputs.libraries) || isReactStoreStale(inputs.store);
    } catch {
        return true;
    }
};

export { resolveCodegenInputs, isCodegenStale, type CodegenInputs };
