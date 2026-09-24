import { sortStrings, sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirIndex, GirTypeEntry } from "./gir-index.js";
import { isEmittableProperty } from "../../analysis/property-admission.js";
import {
    configuredConstructOnlyPropsFor,
    inheritableConfiguredConstructOnlyPropsFor,
} from "./element-prop-imports.js";
import { getChain } from "./gir-index.js";
import { ancestorGlibNames, type GlibNamedClass } from "./intrinsic-elements.js";

const constructOnlyNamesFor = (library: Library, klass: GirClass): string[] =>
    klass.properties
        .filter((property) => property.constructOnly && isEmittableProperty(library, property))
        .map((property) => toCamelIdentifier(property.name));

const girConstructOnlyPropNames = (context: GirIndex, entry: GirTypeEntry): string[] => {
    const names: Set<string> = new Set();

    for (const klass of getChain(context, entry)) {
        for (const name of constructOnlyNamesFor(context.library, klass)) {
            names.add(name);
        }
    }

    return sortStrings(names);
};

const mergeConstructOnlyPropNames = (
    context: GirIndex,
    entry: GlibNamedClass,
    configured: Iterable<string>,
): string[] => {
    const names: Set<string> = new Set(configured);
    const indexed = context.index.get(entry.glibName);

    if (indexed !== undefined) {
        for (const name of girConstructOnlyPropNames(context, indexed)) {
            names.add(name);
        }
    }

    return sortStrings(names);
};

const constructOnlyPropNames = (context: GirIndex, entry: GlibNamedClass): string[] => {
    const ancestors = ancestorGlibNames(entry.klass, entry.namespace, context.library);

    return mergeConstructOnlyPropNames(
        context,
        entry,
        configuredConstructOnlyPropsFor(entry.glibName, ancestors),
    );
};

const namedPropsConstructOnlyPropNames = (context: GirIndex, entry: GlibNamedClass): string[] =>
    mergeConstructOnlyPropNames(
        context,
        entry,
        inheritableConfiguredConstructOnlyPropsFor(
            ancestorGlibNames(entry.klass, entry.namespace, context.library),
        ),
    );

const renderConstructOnlyUnion = (constructOnly: string[]): string =>
    constructOnly.map((name) => sourceStringLiteral(name)).join(" | ");

const renderGeneratedElementProps = (props: string, constructOnly: string[]): string =>
    constructOnly.length === 0
        ? props
        : `GeneratedElementProps<${props}, ${renderConstructOnlyUnion(constructOnly)}>`;

export {
    constructOnlyPropNames,
    girConstructOnlyPropNames,
    namedPropsConstructOnlyPropNames,
    renderConstructOnlyUnion,
    renderGeneratedElementProps,
};
