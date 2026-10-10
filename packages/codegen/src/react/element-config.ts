import type { ElementConfigOptions } from "@gtkx/config";
import { BUILTIN_ELEMENTS, type ElementPropsExport, type ModuleExport } from "@gtkx/config/elements";
import type { OmittedProps } from "../store/jsx/omitted-props.js";
import { PROPS_ORIGIN, resolvePropsModule } from "../docs/props-modules.js";

/** The framework's built-in element config, split into the maps codegen consumes. */
type BuiltinElements = {
    /** Component wrappers keyed by GLib type name; an element without one inherits its nearest ancestor's. */
    components: Record<string, ModuleExport>;
    /** GLib type names with no GObject of their own, exported as elements that drop their construct-only props. */
    lazyElements: string[];
    /** Base props interfaces the generated element props extend, keyed by GLib type name. */
    props: Record<string, ElementPropsExport>;
    /** Props left out of the generated element props, keyed by GLib type name. */
    omittedProps: OmittedProps;
};

type DocsBuiltinElements = BuiltinElements & { acceptedChildTypes: Record<string, string[]> };

const applyBuiltinElement = (target: BuiltinElements, type: string, config: ElementConfigOptions): void => {
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

const collectBuiltinElements = (target: BuiltinElements, elements: Record<string, ElementConfigOptions>): void => {
    for (const [type, config] of Object.entries(elements)) {
        applyBuiltinElement(target, type, config);
    }
};

/**
 * Reads the framework's built-in element metadata without importing the renderer or generated bindings.
 */
const readBuiltinElements = (): Promise<BuiltinElements> => {
    const result: BuiltinElements = {
        components: {},
        lazyElements: [],
        props: {},
        omittedProps: {},
    };
    collectBuiltinElements(result, BUILTIN_ELEMENTS);

    return Promise.resolve(result);
};

const readBuiltinElementsForDocs = (): Promise<DocsBuiltinElements> => {
    const elements = BUILTIN_ELEMENTS;
    const result: DocsBuiltinElements = {
        components: {},
        lazyElements: [],
        props: {},
        omittedProps: {},
        acceptedChildTypes: {},
    };

    collectBuiltinElements(result, elements);

    result.props = Object.fromEntries(
        Object.entries(result.props).map(([type, ref]) => [
            type,
            { ...ref, module: resolvePropsModule(ref.module, PROPS_ORIGIN) },
        ]),
    );

    for (const [type, config] of Object.entries(elements)) {
        if (config.acceptedChildTypes !== undefined) {
            result.acceptedChildTypes[type] = [...config.acceptedChildTypes];
        }
    }

    return Promise.resolve(result);
};

export type { ModuleExport } from "@gtkx/config/elements";
export { readBuiltinElements, readBuiltinElementsForDocs, type BuiltinElements };
