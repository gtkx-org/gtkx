import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type CodegenFingerprint, computeFingerprint, FINGERPRINT_FILENAME } from "@gtkx/codegen";
import type { ElementProp, GtkxConfig } from "@gtkx/config";
import { sortedStrings } from "@gtkx/utils";
import { resolveGirPath } from "./gir-resolver.js";
import { resolveLibraries } from "./library-resolver.js";
import { type CodegenStore, resolveCodegenStore } from "./store-resolver.js";

export type CodegenInputs = {
    girPath: string[];
    libraries: string[];
    elementProps: Record<string, ElementProp[]>;
    store: CodegenStore;
};

export const resolveCodegenInputs = (cwd: string, config: GtkxConfig): CodegenInputs => {
    const girPath = resolveGirPath(config.girPath);
    const libraries = resolveLibraries(config.libraries, girPath);
    const store = resolveCodegenStore(cwd);
    return { girPath, libraries, elementProps: config.elementProps ?? {}, store };
};

const REACT_GENERATED_MODULES: string[] = ["metadata.js", join("gtk", "gtk.js")];

const namespaceBarrelPath = (giStoreDir: string, library: string): string => {
    const separator = library.indexOf("-");
    const namespace = (separator === -1 ? library : library.slice(0, separator)).toLowerCase();
    return join(giStoreDir, namespace, "index.js");
};

const giStoreLinksResolve = (giStoreDir: string): boolean =>
    existsSync(join(giStoreDir, "node_modules", "@gtkx", "gi", "package.json"));

const fingerprintStale = (
    giStoreDir: string,
    libraries: string[],
    elementProps: Record<string, ElementProp[]>,
): boolean => {
    const sentinelPath = join(giStoreDir, FINGERPRINT_FILENAME);
    if (!existsSync(sentinelPath)) return true;
    let sentinel: CodegenFingerprint;
    try {
        sentinel = JSON.parse(readFileSync(sentinelPath, "utf8")) as CodegenFingerprint;
    } catch {
        return true;
    }
    const sortAlpha = (values: string[]): string => sortedStrings(values).join(",");
    if (sortAlpha(sentinel.libraries) !== sortAlpha(libraries)) return true;
    try {
        return computeFingerprint(sentinel.girFiles, sentinel.libraries, elementProps) !== sentinel.value;
    } catch {
        return true;
    }
};

export const isCodegenStale = (inputs: CodegenInputs): boolean => {
    try {
        const { store, libraries, elementProps } = inputs;
        if (!existsSync(store.giLinkDir) || !existsSync(store.giStoreDir)) {
            return true;
        }
        if (!giStoreLinksResolve(store.giStoreDir)) {
            return true;
        }
        if (libraries.some((library) => !existsSync(namespaceBarrelPath(store.giStoreDir, library)))) {
            return true;
        }
        if (store.react !== null) {
            if (!existsSync(store.jsxLinkDir)) return true;
            if (REACT_GENERATED_MODULES.some((module) => !existsSync(join(store.jsxStoreDir, module)))) return true;
        }
        return fingerprintStale(store.giStoreDir, libraries, elementProps);
    } catch {
        return true;
    }
};
