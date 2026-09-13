import type { GirAnnotations } from "../../gir/annotations.js";
import type { GirIndex, GirTypeEntry } from "./gir-index.js";
import { girConstructOnlyPropNames } from "./element-construct-only.js";
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

const createLazyElementSpec = (context: GirIndex, element: string, entry: GirTypeEntry): LazyElementSpec => {
    const typeName = `${element}ElementProps`;
    const baseName = getGlibName(entry.klass) ?? element;
    const omitted = girConstructOnlyPropNames(context, entry);
    const omitUnion = omitted.map((name) => JSON.stringify(name)).join(" | ");
    const base = omitted.length === 0 ? `${baseName}Props` : `Omit<${baseName}Props, ${omitUnion}>`;

    return {
        element,
        typeName,
        typeSource: `export type ${typeName} = ${base} & { children?: ReactNode };`,
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

export { lazyElementSpecs, type LazyElementSpec };
