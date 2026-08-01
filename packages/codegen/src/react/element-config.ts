import type { ModuleExport } from "@gtkx/react/internal";
import { readdirSync } from "node:fs";
import type { OmittedProps } from "../store/jsx/omitted-props.js";

type BuiltinElement = { component?: ModuleExport; isLazy?: boolean; props?: ModuleExport; omittedProps?: string[] };

/** The framework's built-in element config, split into the maps codegen consumes. */
type BuiltinElements = {
    /** Component wrappers keyed by GLib type name; an element without one inherits its nearest ancestor's. */
    components: Record<string, ModuleExport>;
    /** GLib type names with no GObject of their own, exported as elements that drop their construct-only props. */
    lazyElements: string[];
    /** Base props interfaces the generated element props extend, keyed by GLib type name. */
    props: Record<string, ModuleExport>;
    /** Props left out of the generated element props, keyed by GLib type name. */
    omittedProps: OmittedProps;
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

    if (config.omittedProps !== undefined) {
        target.omittedProps[type] = [...(target.omittedProps[type] ?? []), ...config.omittedProps];
    }

    if (config.isLazy === true) {
        target.lazyElements.push(type);
    }
};

const collectBuiltinElements = (target: BuiltinElements, elements: Record<string, BuiltinElement>): void => {
    for (const [type, config] of Object.entries(elements)) {
        applyBuiltinElement(target, type, config);
    }
};

/**
 * Reads the framework's built-in element config by importing the `config` entrypoints of the installed
 * `@gtkx/react`, skipping the per-namespace ones whose namespace the gi store does not carry. Those
 * entrypoints are reconciler-free, so importing them resolves `@gtkx/gi` but never `virtual:gtkx-config`,
 * which means this must run only after the gi store has been written and linked.
 *
 * @param reactSubexports Subexport names of the installed `@gtkx/react`, as `resolveStore` reports them.
 * @param giStoreDir The gi store directory, whose subdirectories name the generated namespaces.
 */
const readBuiltinElements = async (reactSubexports: string[], giStoreDir: string): Promise<BuiltinElements> => {
    const present = presentNamespaceDirs(giStoreDir);
    const entrypoints = configEntrypoints(reactSubexports, present);
    const result: BuiltinElements = { components: {}, lazyElements: [], props: {}, omittedProps: {} };

    for (const entrypoint of entrypoints) {
        collectBuiltinElements(result, await importBuiltinElements(entrypoint));
    }

    return result;
};

export type { ModuleExport } from "@gtkx/react/internal";
export { readBuiltinElements, type BuiltinElement, type BuiltinElements };
