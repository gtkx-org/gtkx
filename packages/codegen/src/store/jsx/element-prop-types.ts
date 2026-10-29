import type { GirAnnotations } from "../../gir/annotations.js";
import type { GirIndex, GirTypeEntry } from "./gir-index.js";
import { girConstructOnlyPropNames } from "./element-construct-only.js";
import { configuredConstructOnlyPropsFor } from "./element-prop-imports.js";
import { getGlibName } from "./intrinsic-elements.js";

type LazyElementSpec = {
    element: string;
    typeName: string;
    typeSource: string;
    doc: string | undefined;
    annotations: GirAnnotations;
    namespaceName: string;
    className: string;
};

const LAZY_CHILDREN_PROP = {
    name: "children",
    type: "ReactNode",
    doc: "The widget the parent container attaches, creating this element's object for it.",
};

const lazyOmittedPropNames = (context: GirIndex, element: string, entry: GirTypeEntry): string[] => {
    const supported = new Set(configuredConstructOnlyPropsFor(element, [element]));

    return girConstructOnlyPropNames(context, entry).filter((name) => !supported.has(name));
};

const createLazyElementSpec = (context: GirIndex, element: string, entry: GirTypeEntry): LazyElementSpec => {
    const typeName = `${element}ElementProps`;
    const baseName = getGlibName(entry.klass) ?? element;
    const omitted = lazyOmittedPropNames(context, element, entry);
    const omitUnion = omitted.map((name) => JSON.stringify(name)).join(" | ");
    const base = omitted.length === 0 ? `${baseName}Props` : `Omit<${baseName}Props, ${omitUnion}>`;
    const { name, type, doc } = LAZY_CHILDREN_PROP;

    return {
        element,
        typeName,
        typeSource: `export type ${typeName} = ${base} & { /** ${doc} */ ${name}?: ${type} };`,
        doc: entry.klass.doc,
        annotations: entry.klass.annotations,
        namespaceName: entry.namespace.name,
        className: entry.klass.name,
    };
};

const lazyElementSpecs = (context: GirIndex, lazyElements: string[]): Map<string, LazyElementSpec[]> => {
    const specs: Map<string, LazyElementSpec[]> = new Map();

    for (const element of lazyElements) {
        const entry = context.index.get(element);

        if (entry === undefined) {
            continue;
        }

        const list = specs.get(entry.namespace.name) ?? [];
        list.push(createLazyElementSpec(context, element, entry));
        specs.set(entry.namespace.name, list);
    }

    return specs;
};

const lazyOmittedProps = (context: GirIndex, lazyElements: string[]): Map<string, string[]> => {
    const omitted: Map<string, string[]> = new Map();

    for (const element of lazyElements) {
        const entry = context.index.get(element);

        if (entry !== undefined) {
            omitted.set(element, lazyOmittedPropNames(context, element, entry));
        }
    }

    return omitted;
};

export { LAZY_CHILDREN_PROP, lazyElementSpecs, lazyOmittedProps, type LazyElementSpec };
