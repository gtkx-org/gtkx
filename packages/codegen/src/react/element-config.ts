import type { ModuleExport } from "@gtkx/react/config";
import type { OmittedProps } from "../store/jsx/omitted-props.js";

type BuiltinElement = {
    component?: ModuleExport;
    isLazy?: boolean;
    props?: ModuleExport;
    omittedProps?: string[];
    acceptedChildTypes?: string[];
};

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

type DocsBuiltinElements = BuiltinElements & { acceptedChildTypes: Record<string, string[]> };

const CONFIG_SPECIFIER = "@gtkx/react/config";

const importBuiltinElements = async (): Promise<Record<string, BuiltinElement>> => {
    const imported = (await import(/* @vite-ignore */ CONFIG_SPECIFIER)) as {
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
 * Reads the framework's built-in element config by importing the `config` entrypoint of the installed
 * `@gtkx/react`. That entrypoint is reconciler-free, so importing it resolves `@gtkx/gi` but never
 * `virtual:gtkx-config`, which means this must run only after the gi store has been written and linked.
 */
const readBuiltinElements = async (): Promise<BuiltinElements> => {
    const result: BuiltinElements = {
        components: {},
        lazyElements: [],
        props: {},
        omittedProps: {},
    };
    collectBuiltinElements(result, await importBuiltinElements());

    return result;
};

const readBuiltinElementsForDocs = async (): Promise<DocsBuiltinElements> => {
    const elements = await importBuiltinElements();
    const result: DocsBuiltinElements = {
        components: {},
        lazyElements: [],
        props: {},
        omittedProps: {},
        acceptedChildTypes: {},
    };

    collectBuiltinElements(result, elements);

    for (const [type, config] of Object.entries(elements)) {
        if (config.acceptedChildTypes !== undefined) {
            result.acceptedChildTypes[type] = [...config.acceptedChildTypes];
        }
    }

    return result;
};

export type { ModuleExport } from "@gtkx/react/config";
export { readBuiltinElements, readBuiltinElementsForDocs, type BuiltinElements };
