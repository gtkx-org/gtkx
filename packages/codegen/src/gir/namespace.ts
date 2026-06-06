import { boxedFromNode, type GirBoxed, isVtableRecord } from "./boxed.js";
import { callbackFromNode, type GirCallback } from "./callback.js";
import { classFromNode, type GirClass } from "./class.js";
import { enumFromNode, type GirEnum } from "./enum.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, childrenOf, type RawNode } from "./parse.js";
import { type GirTypeRef, typeRefFromSlot } from "./type-ref.js";

/** A `<constant>` declaration at namespace level. */
export type GirConstant = {
    readonly name: string;
    /** Constant value as the raw string from GIR. */
    readonly value: string;
    readonly type: GirTypeRef | undefined;
};

/** A `<alias>` declaration at namespace level. */
export type GirAlias = {
    readonly name: string;
    readonly target: GirTypeRef | undefined;
};

/**
 * A single namespace loaded from one `.gir` file.
 *
 * The class lives in `namespace.ts` (mutable holder) because populating it
 * involves walking the raw XML tree once, materialising each construct.
 * After construction the public surface is read-only by convention.
 */
export type GirNamespace = {
    /** Namespace name (e.g. `"Gtk"`). */
    readonly name: string;
    /** Comma-separated `shared-library` value (passed verbatim to `t.fn(...)`). */
    readonly sharedLibrary: string | undefined;
    /** GIR `c:symbol-prefixes` (used to strip function prefixes). */
    readonly cSymbolPrefixes: readonly string[];
    /** Other namespaces referenced via `<include>`. */
    readonly includes: readonly NamespaceInclude[];
    readonly classes: readonly GirClass[];
    readonly interfaces: readonly GirClass[];
    readonly boxeds: readonly GirBoxed[];
    readonly enums: readonly GirEnum[];
    readonly callbacks: readonly GirCallback[];
    readonly functions: readonly GirFunction[];
    readonly constants: readonly GirConstant[];
    readonly aliases: readonly GirAlias[];
};

/** A `<include>` entry pointing at another namespace identifier. */
type NamespaceInclude = {
    readonly name: string;
    readonly version: string;
};

/**
 * Builds a {@link GirNamespace} from a parsed `<repository>` root.
 *
 * @param repositoryNode - The raw `<repository>` element returned by `parseGirFile`
 */
export const namespaceFromRepository = (repositoryNode: RawNode): GirNamespace => {
    const includes = childrenOf(repositoryNode, "include").map<NamespaceInclude>((include) => ({
        name: attr(include, "name") ?? "",
        version: attr(include, "version") ?? "",
    }));
    const namespaceNode = childrenOf(repositoryNode, "namespace")[0];
    if (namespaceNode === undefined) {
        throw new Error("GIR repository has no <namespace> child");
    }
    const name = attr(namespaceNode, "name") ?? "";
    return {
        name,
        sharedLibrary: attr(namespaceNode, "shared-library"),
        cSymbolPrefixes: splitPrefixes(attr(namespaceNode, "c:symbol-prefixes")),
        includes,
        classes: childrenOf(namespaceNode, "class").map((klass) => classFromNode(klass, false)),
        interfaces: childrenOf(namespaceNode, "interface").map((iface) => classFromNode(iface, true)),
        boxeds: collectBoxeds(namespaceNode),
        enums: collectEnums(namespaceNode),
        callbacks: childrenOf(namespaceNode, "callback").map(callbackFromNode),
        functions: childrenOf(namespaceNode, "function").map((fn) => functionFromNode(fn, "function")),
        constants: childrenOf(namespaceNode, "constant").map((constant) => ({
            name: attr(constant, "name") ?? "",
            value: attr(constant, "value") ?? "",
            type: typeRefFromSlot(constant),
        })),
        aliases: childrenOf(namespaceNode, "alias").map((alias) => ({
            name: attr(alias, "name") ?? "",
            target: typeRefFromSlot(alias),
        })),
    };
};

const splitPrefixes = (raw: string | undefined): readonly string[] =>
    (raw ?? "").split(",").filter((prefix) => prefix.length > 0);

const collectBoxeds = (namespaceNode: RawNode): readonly GirBoxed[] => [
    ...childrenOf(namespaceNode, "record").map((record) => boxedFromNode(record, isVtableRecord(record), false)),
    ...childrenOf(namespaceNode, "union").map((union) => boxedFromNode(union, isVtableRecord(union), true)),
];

const collectEnums = (namespaceNode: RawNode) => [
    ...childrenOf(namespaceNode, "enumeration").map((enumeration) => enumFromNode(enumeration, "enumeration")),
    ...childrenOf(namespaceNode, "bitfield").map((bitfield) => enumFromNode(bitfield, "bitfield")),
];
