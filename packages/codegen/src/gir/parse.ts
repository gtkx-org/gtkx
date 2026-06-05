import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

/**
 * Raw GIR XML element after parsing.
 *
 * Attributes are exposed under `@_<name>` keys (the default
 * `fast-xml-parser` convention). Child elements appear under their tag name.
 * Multi-occurrence tags (every container in {@link MULTI_TAGS}) are always
 * arrays so callers do not need to disambiguate "single child" from "many
 * children" at every access. Single-occurrence tags appear as bare objects.
 */
export type RawNode = {
    readonly [attributeOrChild: string]: unknown;
};

/**
 * Tag names that the GIR schema permits at multi-occurrence positions.
 *
 * `fast-xml-parser` is configured to always materialize these as arrays so
 * downstream traversal never needs to branch on "is this an object or an
 * array of objects". Tags missing from this set may appear as a single
 * object (e.g. `<return-value>`, `<parameters>`, `<type>`, `<doc>`).
 */
const MULTI_TAGS: ReadonlySet<string> = new Set([
    "include",
    "class",
    "interface",
    "record",
    "enumeration",
    "bitfield",
    "callback",
    "function",
    "constant",
    "alias",
    "union",
    "method",
    "constructor",
    "virtual-method",
    "property",
    "field",
    "glib:signal",
    "implements",
    "prerequisite",
    "member",
    "parameter",
]);

/**
 * The tag name codegen reads GIR constructors under.
 *
 * GIR spells constructors `<constructor>`, but `fast-xml-parser` rejects the
 * literal names `constructor`, `prototype`, and `__proto__` to guard against
 * prototype pollution, with no opt-out. {@link parseGirFile} rewrites the tag
 * to this token via `transformTagName` before that guard runs, so every
 * downstream lookup of a constructor child must use this constant rather than
 * the raw GIR name.
 */
export const GIR_CONSTRUCTOR_TAG = "gir-constructor";

const RESERVED_TAG_RENAMES: ReadonlyMap<string, string> = new Map([["constructor", GIR_CONSTRUCTOR_TAG]]);

/**
 * Maps a GIR tag name to the token the parser exposes it under, rewriting the
 * names {@link RESERVED_TAG_RENAMES} covers and passing every other tag
 * through unchanged.
 *
 * @param tag - The raw GIR tag name
 */
const renameReservedTag = (tag: string): string => RESERVED_TAG_RENAMES.get(tag) ?? tag;

const RENAMED_MULTI_TAGS: ReadonlySet<string> = new Set([...MULTI_TAGS].map(renameReservedTag));

const PARSER = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    transformTagName: renameReservedTag,
    isArray: (name) => RENAMED_MULTI_TAGS.has(name),
});

/**
 * Parses a GIR XML file from disk and returns its raw tree.
 *
 * The returned object always has a single `repository` property containing
 * the root `<repository>` element. Callers should not interpret the tree
 * directly — pass it to {@link loadGirRepository} (in `./repository.ts`),
 * which builds the typed domain model on top of it.
 *
 * @param path - Absolute path to a `.gir` file
 * @returns The raw repository node
 */
export const parseGirFile = (path: string): RawNode => {
    const xml = readFileSync(path, "utf-8");
    return PARSER.parse(xml) as RawNode;
};

/**
 * Reads an attribute from a raw GIR node as a string, returning `undefined`
 * when the attribute is absent.
 *
 * The `@_` prefix is added by `fast-xml-parser`; this helper hides that
 * convention from the call sites.
 *
 * @param node - The raw element
 * @param name - The attribute name (without the `@_` prefix)
 */
export const attr = (node: RawNode | undefined, name: string): string | undefined => {
    if (node === undefined) return undefined;
    const value = node[`@_${name}`];
    return typeof value === "string" ? value : undefined;
};

/**
 * Reads an attribute as a boolean using GIR's `"1"` / `"0"` convention.
 *
 * Attributes that are missing return the supplied default (defaulting to
 * `false`). Any non-`"1"` value is treated as `false`.
 *
 * @param node - The raw element
 * @param name - The attribute name (without the `@_` prefix)
 * @param fallback - Value returned when the attribute is missing
 */
export const attrBool = (node: RawNode | undefined, name: string, fallback = false): boolean => {
    const value = attr(node, name);
    if (value === undefined) return fallback;
    return value === "1";
};

/**
 * Returns the children of a raw node under a given tag name as an array.
 *
 * The parser configuration forces multi-occurrence tags to arrays already;
 * this helper covers the residual case where a tag was registered as
 * single-occurrence at the schema level but a particular file emits zero
 * elements (returning `[]`) or where the caller wants a uniform array view.
 *
 * @param node - The parent element
 * @param tag - The child tag name (with namespace prefix if any)
 */
export const childrenOf = (node: RawNode | undefined, tag: string): readonly RawNode[] => {
    if (node === undefined) return [];
    const value = node[tag];
    if (value === undefined) return [];
    if (Array.isArray(value)) return value as readonly RawNode[];
    return [value as RawNode];
};

/**
 * Returns the single child of a raw node under a given tag, or `undefined`
 * if absent. If multiple are present the first is returned.
 *
 * @param node - The parent element
 * @param tag - The child tag name (with namespace prefix if any)
 */
export const childOf = (node: RawNode | undefined, tag: string): RawNode | undefined => {
    if (node === undefined) return undefined;
    const value = node[tag];
    if (value === undefined) return undefined;
    if (Array.isArray(value)) {
        return value.length === 0 ? undefined : (value[0] as RawNode);
    }
    return value as RawNode;
};
