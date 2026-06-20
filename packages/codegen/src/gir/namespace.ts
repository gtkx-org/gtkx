import { boxedFromNode, type GirBoxed, isVtableRecord } from "./boxed.js";
import { callbackFromNode, type GirCallback } from "./callback.js";
import { classFromNode, type GirClass } from "./class.js";
import { enumFromNode, type GirEnum } from "./enum.js";
import { functionFromNode, type GirFunction } from "./function.js";
import { attr, childOf, childrenOf, type RawNode } from "./parse.js";
import type { ParseContext, TypeId } from "./type-id.js";
import { typeRefFromSlot } from "./type-ref.js";

/** A `<constant>` declaration at namespace level. */
export type GirConstant = {
    readonly name: string;
    /** Constant value as the raw string from GIR. */
    readonly value: string;
    readonly type: TypeId | undefined;
};

/** A `<alias>` declaration at namespace level. */
export type GirAlias = {
    readonly name: string;
    /** Interned alias target, or `undefined` when the alias has no type slot. */
    readonly target: TypeId | undefined;
    /** The target's own `c:type`, kept for the record-layout pointer test. */
    readonly targetCType: string | undefined;
};

/**
 * A single namespace loaded from one `.gir` file.
 *
 * Construction is two-phase: {@link createNamespaceShell} builds the shell from
 * the header during discovery, then {@link populateNamespaceBody} fills its
 * entity arrays once every namespace shell exists (so cross-namespace and
 * forward references intern against a known `nsId`). After population the public
 * surface is read-only by convention.
 */
export type GirNamespace = {
    /** Arena id assigned during discovery; selects this namespace's type slots. */
    readonly id: number;
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

/** The mutable shell populated in place by {@link populateNamespaceBody}. */
type MutableNamespace = {
    -readonly [Key in keyof GirNamespace]: GirNamespace[Key];
};

/** The header fields read from a `<repository>`/`<namespace>` during discovery. */
export type NamespaceHeader = {
    readonly name: string;
    readonly sharedLibrary: string | undefined;
    readonly cSymbolPrefixes: readonly string[];
    readonly includes: readonly NamespaceInclude[];
    /** The `<namespace>` element, retained so the body can be parsed later. */
    readonly namespaceNode: RawNode;
};

/**
 * Reads the namespace header (name, library, prefixes, includes) from a parsed
 * `<repository>` root without parsing any entities, so discovery can assign an
 * arena id before forward references are interned.
 *
 * @param repositoryNode - The raw `<repository>` element returned by `parseGirFile`
 */
export const parseNamespaceHeader = (repositoryNode: RawNode): NamespaceHeader => {
    const includes = childrenOf(repositoryNode, "include").map<NamespaceInclude>((include) => ({
        name: attr(include, "name") ?? "",
        version: attr(include, "version") ?? "",
    }));
    const namespaceNode = childrenOf(repositoryNode, "namespace")[0];
    if (namespaceNode === undefined) {
        throw new Error("GIR repository has no <namespace> child");
    }
    return {
        name: attr(namespaceNode, "name") ?? "",
        sharedLibrary: attr(namespaceNode, "shared-library"),
        cSymbolPrefixes: splitPrefixes(attr(namespaceNode, "c:symbol-prefixes")),
        includes,
        namespaceNode,
    };
};

/**
 * Builds an empty namespace shell from its header and arena id.
 *
 * @param header - The parsed namespace header
 * @param id - The arena id assigned during discovery
 */
export const createNamespaceShell = (header: NamespaceHeader, id: number): GirNamespace => ({
    id,
    name: header.name,
    sharedLibrary: header.sharedLibrary,
    cSymbolPrefixes: header.cSymbolPrefixes,
    includes: header.includes,
    classes: [],
    interfaces: [],
    boxeds: [],
    enums: [],
    callbacks: [],
    functions: [],
    constants: [],
    aliases: [],
});

/**
 * Parses every entity of a `<namespace>` and assigns them onto the shell,
 * interning each type slot against `context`.
 *
 * @param shell - The namespace shell created by {@link createNamespaceShell}
 * @param namespaceNode - The `<namespace>` element from the header
 * @param context - The per-namespace interning seam, bound to the shell's id
 */
export const populateNamespaceBody = (shell: GirNamespace, namespaceNode: RawNode, context: ParseContext): void => {
    const mutable: MutableNamespace = shell;
    mutable.classes = childrenOf(namespaceNode, "class").map((klass) => classFromNode(klass, false, context));
    mutable.interfaces = childrenOf(namespaceNode, "interface").map((iface) => classFromNode(iface, true, context));
    mutable.boxeds = collectBoxeds(namespaceNode, context);
    mutable.enums = collectEnums(namespaceNode, context);
    mutable.callbacks = childrenOf(namespaceNode, "callback").map((callback) => callbackFromNode(callback, context));
    mutable.functions = childrenOf(namespaceNode, "function").map((fn) => functionFromNode(fn, "function", context));
    mutable.constants = childrenOf(namespaceNode, "constant").map((constant) => ({
        name: attr(constant, "name") ?? "",
        value: attr(constant, "value") ?? "",
        type: typeRefFromSlot(constant, context),
    }));
    mutable.aliases = childrenOf(namespaceNode, "alias").map((alias) => ({
        name: attr(alias, "name") ?? "",
        target: typeRefFromSlot(alias, context),
        targetCType: attr(childOf(alias, "type"), "c:type"),
    }));
};

const splitPrefixes = (raw: string | undefined): readonly string[] =>
    (raw ?? "").split(",").filter((prefix) => prefix.length > 0);

const collectBoxeds = (namespaceNode: RawNode, context: ParseContext): readonly GirBoxed[] => [
    ...childrenOf(namespaceNode, "record").map((record) =>
        boxedFromNode(record, isVtableRecord(record), false, context),
    ),
    ...childrenOf(namespaceNode, "union").map((union) => boxedFromNode(union, isVtableRecord(union), true, context)),
];

const collectEnums = (namespaceNode: RawNode, context: ParseContext): readonly GirEnum[] => [
    ...childrenOf(namespaceNode, "enumeration").map((enumeration) => enumFromNode(enumeration, "enumeration", context)),
    ...childrenOf(namespaceNode, "bitfield").map((bitfield) => enumFromNode(bitfield, "bitfield", context)),
];
