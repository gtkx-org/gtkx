import type { ModuleExport } from "@gtkx/react/config";
import { readdirSync } from "node:fs";

/** The codegen-relevant subset of a React element config; behaviors are ignored at codegen time. */
type BuiltinElement = { component?: ModuleExport; lazy?: boolean; props?: ModuleExport };

/** The framework's built-in element config, split into the maps codegen consumes. */
type BuiltinElements = {
    components: Record<string, ModuleExport>;
    lazyElements: string[];
    props: Record<string, ModuleExport>;
};

const CONFIG_ENTRYPOINT = "config";
const CONFIG_SUFFIX = `/${CONFIG_ENTRYPOINT}`;

const presentNamespaceDirs = (giStoreDir: string): Set<string> => {
    const dirs: Set<string> = new Set();
    const entries = readdirSync(giStoreDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            dirs.add(entry.name);
        }
    }

    return dirs;
};

/**
 * The clean, reconciler-free `@gtkx/react` config entrypoints to import: the base `config` entry plus
 * each namespace's `<ns>/config` entry whose GIR namespace is present in the gi store.
 */
const configEntrypoints = (reactSubexports: string[], present: Set<string>): string[] =>
    reactSubexports.filter((sub) => {
        if (sub === CONFIG_ENTRYPOINT) {
            return true;
        }

        return sub.endsWith(CONFIG_SUFFIX) && present.has(sub.slice(0, sub.length - CONFIG_SUFFIX.length));
    });

const importBuiltinElements = async (entrypoint: string): Promise<Record<string, BuiltinElement>> => {
    const specifier = `@gtkx/react/${entrypoint}`;

    const imported = (await import(/* @vite-ignore */ specifier)) as {
        BUILTIN_ELEMENTS?: Record<string, BuiltinElement>;
    };

    return imported.BUILTIN_ELEMENTS ?? {};
};

const applyBuiltinElement = (target: BuiltinElements, type: string, config: BuiltinElement): void => {
    if (config.component !== undefined) {
        target.components[type] = config.component;
    }

    if (config.props !== undefined) {
        target.props[type] = config.props;
    }

    if (config.lazy === true) {
        target.lazyElements.push(type);
    }
};

/**
 * Reads the framework's built-in element config by importing the freshly linked `@gtkx/react` config
 * entrypoints. These are reconciler-free, so importing them resolves `@gtkx/gi` but never `virtual:gtkx-config`;
 * it must run only after the gi store has been linked.
 */
const collectBuiltinElements = (target: BuiltinElements, elements: Record<string, BuiltinElement>): void => {
    for (const [type, config] of Object.entries(elements)) {
        applyBuiltinElement(target, type, config);
    }
};

const readBuiltinElements = async (reactSubexports: string[], giStoreDir: string): Promise<BuiltinElements> => {
    const present = presentNamespaceDirs(giStoreDir);
    const entrypoints = configEntrypoints(reactSubexports, present);
    const result: BuiltinElements = { components: {}, lazyElements: [], props: {} };

    for (const entrypoint of entrypoints) {
        collectBuiltinElements(result, await importBuiltinElements(entrypoint));
    }

    return result;
};

export { type ModuleExport } from "@gtkx/react/config";
export { readBuiltinElements, type BuiltinElement, type BuiltinElements };
