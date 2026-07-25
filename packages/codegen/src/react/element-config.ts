import { readdirSync } from "node:fs";
import type { ModuleExport } from "@gtkx/react/config";

export type { ModuleExport };

/** The codegen-relevant subset of a React element config; behaviors are ignored at codegen time. */
export type BuiltinElement = { component?: ModuleExport; lazy?: boolean; props?: ModuleExport };

/** The framework's built-in element config, split into the maps codegen consumes. */
export type BuiltinElements = {
    components: Record<string, ModuleExport>;
    lazyElements: string[];
    props: Record<string, ModuleExport>;
};

const CONFIG_ENTRYPOINT = "config";

const CONFIG_SUFFIX = `/${CONFIG_ENTRYPOINT}`;

const presentNamespaceDirs = (giStoreDir: string): Set<string> => {
    const dirs = new Set<string>();
    for (const entry of readdirSync(giStoreDir, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.add(entry.name);
    }
    return dirs;
};

/**
 * The clean, reconciler-free `@gtkx/react` config entrypoints to import: the base `config` entry plus
 * each namespace's `<ns>/config` entry whose GIR namespace is present in the gi store.
 */
const configEntrypoints = (reactSubexports: string[], present: Set<string>): string[] =>
    reactSubexports.filter((sub) => {
        if (sub === CONFIG_ENTRYPOINT) return true;
        return sub.endsWith(CONFIG_SUFFIX) && present.has(sub.slice(0, sub.length - CONFIG_SUFFIX.length));
    });

const importBuiltinElements = async (entrypoint: string): Promise<Record<string, BuiltinElement>> => {
    const specifier = `@gtkx/react/${entrypoint}`;
    const imported = (await import(/* @vite-ignore */ specifier)) as {
        BUILTIN_ELEMENTS?: Record<string, BuiltinElement>;
    };
    return imported.BUILTIN_ELEMENTS ?? {};
};

/**
 * Reads the framework's built-in element config by importing the freshly linked `@gtkx/react` config
 * entrypoints. These are reconciler-free, so importing them resolves `@gtkx/gi` but never `virtual:gtkx-config`;
 * it must run only after the gi store has been linked.
 */
export const readBuiltinElements = async (reactSubexports: string[], giStoreDir: string): Promise<BuiltinElements> => {
    const present = presentNamespaceDirs(giStoreDir);
    const entrypoints = configEntrypoints(reactSubexports, present);
    const components: Record<string, ModuleExport> = {};
    const props: Record<string, ModuleExport> = {};
    const lazyElements: string[] = [];
    for (const entrypoint of entrypoints) {
        for (const [type, config] of Object.entries(await importBuiltinElements(entrypoint))) {
            if (config.component !== undefined) components[type] = config.component;
            if (config.props !== undefined) props[type] = config.props;
            if (config.lazy === true) lazyElements.push(type);
        }
    }
    return { components, lazyElements, props };
};
