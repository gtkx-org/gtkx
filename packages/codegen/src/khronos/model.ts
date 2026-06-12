import { collectText, nodeAttr, nodeChildren, nodeTag, type OrderedNode, parseRegistryFile } from "./parse.js";

/** One parameter of a registry `<command>`. */
export type GlParam = {
    /** The parameter name from the `<name>` child. */
    readonly name: string;
    /** The C type reconstructed from the mixed content (e.g. `const GLchar *const*`). */
    readonly cType: string;
    /** The enum group the parameter draws from, when annotated. */
    readonly group?: string;
    /** The registry `len` expression, when annotated. */
    readonly len?: string;
    /** The object kind from the `class` annotation (e.g. `buffer`, `shader`). */
    readonly kind?: string;
};

/** One registry `<command>`. */
export type GlCommand = {
    /** The C entry point name (e.g. `glBufferData`). */
    readonly name: string;
    /** The return C type reconstructed from the `<proto>` mixed content. */
    readonly returnCType: string;
    /** The enum group of the return value, when annotated. */
    readonly returnGroup?: string;
    /** The parameters in declaration order. */
    readonly params: readonly GlParam[];
};

/** One registry `<enum>` token. */
export type GlEnum = {
    /** The token name (e.g. `GL_COLOR_BUFFER_BIT`). */
    readonly name: string;
    /** The literal value text (decimal or `0x` hex). */
    readonly value: string;
    /** The API the token value is specific to, when the name is API-overloaded. */
    readonly api?: string;
    /** The C suffix recorded for wide values (`u`, `ull`), when present. */
    readonly typeSuffix?: string;
    /** The groups the token belongs to. */
    readonly groups: readonly string[];
    /** Whether the enclosing `<enums>` block is a bitmask namespace. */
    readonly bitmask: boolean;
};

/** One `<require>` or `<remove>` block of a feature. */
export type GlInterfaceBlock = {
    /** The profile the block applies to, or `undefined` for all profiles. */
    readonly profile?: string;
    /** The API the block applies to, or `undefined` for the feature's API. */
    readonly api?: string;
    /** Command names listed by the block. */
    readonly commands: readonly string[];
    /** Enum token names listed by the block. */
    readonly enums: readonly string[];
};

/** One registry `<feature>` (an API version). */
export type GlFeature = {
    /** The API the feature belongs to (e.g. `gl`, `gles2`). */
    readonly api: string;
    /** The feature name (e.g. `GL_VERSION_4_6`). */
    readonly name: string;
    /** The numeric version (e.g. `4.6`). */
    readonly number: number;
    /** The feature's `<require>` blocks in order. */
    readonly requires: readonly GlInterfaceBlock[];
    /** The feature's `<remove>` blocks in order. */
    readonly removes: readonly GlInterfaceBlock[];
};

/** The typed model of a Khronos GL registry file. */
export type GlRegistry = {
    /** Commands keyed by C entry point name. */
    readonly commands: ReadonlyMap<string, GlCommand>;
    /** Every enum token, in registry order; names may repeat across APIs. */
    readonly enums: readonly GlEnum[];
    /** Every feature, in registry order. */
    readonly features: readonly GlFeature[];
};

const NAME_TAG = "name";
const SKIP_IN_C_TYPE: ReadonlySet<string> = new Set([NAME_TAG, "comment"]);

const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, " ").trim();

const childNamed = (node: OrderedNode, tag: string): OrderedNode | undefined => {
    for (const child of nodeChildren(node)) {
        if (nodeTag(child) === tag) return child;
    }
    return undefined;
};

const elementName = (node: OrderedNode): string => {
    const nameChild = childNamed(node, NAME_TAG);
    if (nameChild === undefined) return "";
    return normalizeWhitespace(collectText(nameChild, new Set()));
};

const parseParam = (node: OrderedNode): GlParam => {
    const param: GlParam = {
        name: elementName(node),
        cType: normalizeWhitespace(collectText(node, SKIP_IN_C_TYPE)),
    };
    const group = nodeAttr(node, "group");
    const len = nodeAttr(node, "len");
    const kind = nodeAttr(node, "class");
    return {
        ...param,
        ...(group !== undefined ? { group } : {}),
        ...(len !== undefined ? { len } : {}),
        ...(kind !== undefined ? { kind } : {}),
    };
};

const parseCommand = (node: OrderedNode): GlCommand | undefined => {
    const proto = childNamed(node, "proto");
    if (proto === undefined) return undefined;
    const params: GlParam[] = [];
    for (const child of nodeChildren(node)) {
        if (nodeTag(child) === "param") params.push(parseParam(child));
    }
    const returnGroup = nodeAttr(proto, "group");
    return {
        name: elementName(proto),
        returnCType: normalizeWhitespace(collectText(proto, SKIP_IN_C_TYPE)),
        ...(returnGroup !== undefined ? { returnGroup } : {}),
        params,
    };
};

const parseEnums = (node: OrderedNode, into: GlEnum[]): void => {
    const bitmask = nodeAttr(node, "type") === "bitmask";
    for (const child of nodeChildren(node)) {
        if (nodeTag(child) !== "enum") continue;
        const name = nodeAttr(child, "name");
        const value = nodeAttr(child, "value");
        if (name === undefined || value === undefined) continue;
        const api = nodeAttr(child, "api");
        const typeSuffix = nodeAttr(child, "type");
        const group = nodeAttr(child, "group");
        into.push({
            name,
            value,
            ...(api !== undefined ? { api } : {}),
            ...(typeSuffix !== undefined ? { typeSuffix } : {}),
            groups: group === undefined ? [] : group.split(",").map((part) => part.trim()),
            bitmask,
        });
    }
};

const parseInterfaceBlock = (node: OrderedNode): GlInterfaceBlock => {
    const commands: string[] = [];
    const enums: string[] = [];
    for (const child of nodeChildren(node)) {
        const name = nodeAttr(child, "name");
        if (name === undefined) continue;
        const tag = nodeTag(child);
        if (tag === "command") commands.push(name);
        else if (tag === "enum") enums.push(name);
    }
    const profile = nodeAttr(node, "profile");
    const api = nodeAttr(node, "api");
    return {
        ...(profile !== undefined ? { profile } : {}),
        ...(api !== undefined ? { api } : {}),
        commands,
        enums,
    };
};

const parseFeature = (node: OrderedNode): GlFeature | undefined => {
    const api = nodeAttr(node, "api");
    const name = nodeAttr(node, "name");
    const number = nodeAttr(node, "number");
    if (api === undefined || name === undefined || number === undefined) return undefined;
    const requires: GlInterfaceBlock[] = [];
    const removes: GlInterfaceBlock[] = [];
    for (const child of nodeChildren(node)) {
        const tag = nodeTag(child);
        if (tag === "require") requires.push(parseInterfaceBlock(child));
        else if (tag === "remove") removes.push(parseInterfaceBlock(child));
    }
    return { api, name, number: Number.parseFloat(number), requires, removes };
};

const parseCommandsSection = (section: OrderedNode, into: Map<string, GlCommand>): void => {
    for (const child of nodeChildren(section)) {
        if (nodeTag(child) !== "command") continue;
        const command = parseCommand(child);
        if (command !== undefined && command.name.length > 0) into.set(command.name, command);
    }
};

/**
 * Loads and types a Khronos GL registry file.
 *
 * Reads `<commands>`, `<enums>`, and `<feature>` sections; `<types>`,
 * `<kinds>`, `<groups>`, `<extensions>`, and `<comment>` content is skipped —
 * extensions are outside the supported selection surface and the rest carries
 * no information the generator consumes.
 *
 * @param path - Absolute path to the registry XML file (the vendored `gl.xml`)
 */
export const loadGlRegistry = (path: string): GlRegistry => {
    const commands = new Map<string, GlCommand>();
    const enums: GlEnum[] = [];
    const features: GlFeature[] = [];
    for (const section of parseRegistryFile(path)) {
        const tag = nodeTag(section);
        if (tag === "commands") {
            parseCommandsSection(section, commands);
        } else if (tag === "enums") {
            parseEnums(section, enums);
        } else if (tag === "feature") {
            const feature = parseFeature(section);
            if (feature !== undefined) features.push(feature);
        }
    }
    return { commands, enums, features };
};
