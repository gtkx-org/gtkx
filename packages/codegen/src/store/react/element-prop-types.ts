import { toCamelIdentifier } from "@gtkx/utils";
import { chainOf, type GirIndex, type GirTypeEntry } from "./gir-index.js";
import { glibNameOf } from "./intrinsic-elements.js";

export type LazyElementSpec = {
    element: string;
    typeName: string;
    typeSource: string;
};

const constructOnlyNames = (context: GirIndex, entry: GirTypeEntry): string[] => {
    const names: string[] = [];
    for (const klass of chainOf(context, entry)) {
        for (const property of klass.properties) {
            if (property.constructOnly) names.push(toCamelIdentifier(property.name));
        }
    }
    return names;
};

const specFor = (context: GirIndex, element: string, entry: GirTypeEntry): LazyElementSpec => {
    const typeName = `${element}ElementProps`;
    const baseName = glibNameOf(entry.klass) ?? element;
    const omitted = constructOnlyNames(context, entry);
    const omitUnion = omitted.map((name) => JSON.stringify(name)).join(" | ");
    const base = omitted.length === 0 ? `${baseName}Props` : `Omit<${baseName}Props, ${omitUnion}>`;
    return { element, typeName, typeSource: `export type ${typeName} = ${base} & { children?: ReactNode };` };
};

/** Lazy element prop types to emit, grouped by the namespace declaring each element. */
export const lazyElementSpecs = (context: GirIndex, lazyElements: string[]): Map<string, LazyElementSpec[]> => {
    const specs = new Map<string, LazyElementSpec[]>();
    for (const element of lazyElements) {
        const entry = context.index.get(element);
        if (entry === undefined) continue;
        const list = specs.get(entry.namespace.name) ?? [];
        list.push(specFor(context, element, entry));
        specs.set(entry.namespace.name, list);
    }
    return specs;
};
