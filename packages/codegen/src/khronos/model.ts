import { sortStrings } from "@gtkx/utils";
import { collectText, nodeAttr, nodeChildren, nodeTag, type OrderedNode, parseRegistryFile } from "./parse.js";

type GlParam = {
    name: string;
    cType: string;
    group?: string;
    len?: string;
    objectClass?: string;
    kinds: string[];
};

type GlGlx = {
    type: string;
    opcode: string;
    comment?: string;
};

type GlCommand = {
    name: string;
    returnCType: string;
    returnGroup?: string;
    returnObjectClass?: string;
    returnKinds: string[];
    comment?: string;
    aliasTarget?: string;
    vecEquiv?: string;
    glx?: GlGlx;
    params: GlParam[];
};

type GlEnum = {
    name: string;
    value: string;
    groups: string[];
    comment?: string;
    alias?: string;
    api?: string;
    valueType?: string;
    vendor?: string;
    blockComment?: string;
    isBitmask: boolean;
};

type GlEnumBlock = {
    group?: string;
    vendor?: string;
    comment?: string;
    isBitmask: boolean;
};

type GlInterfaceBlock = {
    kind: "require" | "remove";
    api?: string;
    profile?: string;
    comment?: string;
    commands: string[];
    enums: string[];
};

type GlFeature = {
    api: string;
    name: string;
    number: number;
    blocks: GlInterfaceBlock[];
};

type GlExtension = {
    name: string;
    supported: string[];
    comment?: string;
    blocks: GlInterfaceBlock[];
};

type GlType = {
    name: string;
    declaration: string;
    requires?: string;
    comment?: string;
};

type GlRegistry = {
    comment?: string;
    types: Map<string, GlType>;
    kinds: Map<string, string>;
    commands: Map<string, GlCommand>;
    enums: GlEnum[];
    features: GlFeature[];
    extensions: GlExtension[];
    aliasTargets: Map<string, string[]>;
    bitmaskGroups: Set<string>;
};

type CommandExtras = {
    params: GlParam[];
    aliasTarget: string | undefined;
    vecEquiv: string | undefined;
    glx: GlGlx | undefined;
};

type SectionHandler = (section: OrderedNode, registry: GlRegistry) => void;

const NAME_TAG = "name";
const SKIP_IN_C_TYPE: Set<string> = new Set([NAME_TAG, "comment"]);
const EMPTY_SKIP: Set<string> = new Set();

const definedEntry = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> =>
    value === undefined ? {} : ({ [key]: value } as Partial<Record<K, V>>);

const normalizeWhitespace = (text: string): string => text.replaceAll(/\s+/g, " ").trim();

const normalizeBlockText = (text: string): string =>
    text
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .trim();

const splitAttr = (value: string | undefined, separator: string): string[] =>
    value === undefined ? [] : value.split(separator).map((part) => part.trim());

const childNamed = (node: OrderedNode, tag: string): OrderedNode | undefined => {
    for (const child of nodeChildren(node)) {
        if (nodeTag(child) === tag) {
            return child;
        }
    }

    return undefined;
};

const elementName = (node: OrderedNode): string => {
    const nameChild = childNamed(node, NAME_TAG);

    if (nameChild === undefined) {
        return "";
    }

    return normalizeWhitespace(collectText(nameChild, EMPTY_SKIP));
};

const parseParam = (node: OrderedNode): GlParam => ({
    name: elementName(node),
    cType: normalizeWhitespace(collectText(node, SKIP_IN_C_TYPE)),
    kinds: splitAttr(nodeAttr(node, "kind"), ","),
    ...definedEntry("group", nodeAttr(node, "group")),
    ...definedEntry("len", nodeAttr(node, "len")),
    ...definedEntry("objectClass", nodeAttr(node, "class")),
});

const parseGlx = (node: OrderedNode): GlGlx | undefined => {
    const type = nodeAttr(node, "type");
    const opcode = nodeAttr(node, "opcode");

    if (type === undefined || opcode === undefined || nodeAttr(node, NAME_TAG) !== undefined) {
        return undefined;
    }

    return { type, opcode, ...definedEntry("comment", nodeAttr(node, "comment")) };
};

const collectCommandChild = (child: OrderedNode, into: CommandExtras): void => {
    switch (nodeTag(child)) {
        case "param": {
            into.params.push(parseParam(child));
            break;
        }
        case "alias": {
            into.aliasTarget = nodeAttr(child, NAME_TAG);
            break;
        }
        case "vecequiv": {
            into.vecEquiv = nodeAttr(child, NAME_TAG);
            break;
        }
        case "glx": {
            into.glx ??= parseGlx(child);
            break;
        }
        default: {
            break;
        }
    }
};

const parseCommand = (node: OrderedNode): GlCommand | undefined => {
    const proto = childNamed(node, "proto");

    if (proto === undefined) {
        return undefined;
    }

    const extras: CommandExtras = { params: [], aliasTarget: undefined, vecEquiv: undefined, glx: undefined };

    for (const child of nodeChildren(node)) {
        collectCommandChild(child, extras);
    }

    return {
        name: elementName(proto),
        returnCType: normalizeWhitespace(collectText(proto, SKIP_IN_C_TYPE)),
        returnKinds: splitAttr(nodeAttr(proto, "kind"), ","),
        ...definedEntry("returnGroup", nodeAttr(proto, "group")),
        ...definedEntry("returnObjectClass", nodeAttr(proto, "class")),
        ...definedEntry("comment", nodeAttr(node, "comment")),
        ...definedEntry("aliasTarget", extras.aliasTarget),
        ...definedEntry("vecEquiv", extras.vecEquiv),
        ...definedEntry("glx", extras.glx),
        params: extras.params,
    };
};

const parseEnum = (child: OrderedNode, block: GlEnumBlock): GlEnum | undefined => {
    const name = nodeAttr(child, NAME_TAG);
    const value = nodeAttr(child, "value");

    if (name === undefined || value === undefined || nodeTag(child) !== "enum") {
        return undefined;
    }

    return {
        name,
        value,
        groups: splitAttr(nodeAttr(child, "group") ?? block.group, ","),
        isBitmask: block.isBitmask,
        ...definedEntry("comment", nodeAttr(child, "comment")),
        ...definedEntry("alias", nodeAttr(child, "alias")),
        ...definedEntry("api", nodeAttr(child, "api")),
        ...definedEntry("valueType", nodeAttr(child, "type")),
        ...definedEntry("vendor", block.vendor),
        ...definedEntry("blockComment", block.comment),
    };
};

const enumBlockFor = (node: OrderedNode): GlEnumBlock => ({
    isBitmask: nodeAttr(node, "type") === "bitmask",
    ...definedEntry("group", nodeAttr(node, "group")),
    ...definedEntry("vendor", nodeAttr(node, "vendor")),
    ...definedEntry("comment", nodeAttr(node, "comment")),
});

const parseEnums = (node: OrderedNode, registry: GlRegistry): void => {
    const block = enumBlockFor(node);

    if (block.isBitmask && block.group !== undefined) {
        registry.bitmaskGroups.add(block.group);
    }

    for (const child of nodeChildren(node)) {
        const parsed = parseEnum(child, block);

        if (parsed !== undefined) {
            registry.enums.push(parsed);
        }
    }
};

const collectInterfaceMember = (child: OrderedNode, commands: string[], enums: string[]): void => {
    const name = nodeAttr(child, NAME_TAG);

    if (name === undefined) {
        return;
    }

    const tag = nodeTag(child);

    if (tag === "command") {
        commands.push(name);
    } else if (tag === "enum") {
        enums.push(name);
    }
};

const parseInterfaceBlock = (node: OrderedNode, kind: GlInterfaceBlock["kind"]): GlInterfaceBlock => {
    const commands: string[] = [];
    const enums: string[] = [];

    for (const child of nodeChildren(node)) {
        collectInterfaceMember(child, commands, enums);
    }

    return {
        kind,
        ...definedEntry("api", nodeAttr(node, "api")),
        ...definedEntry("profile", nodeAttr(node, "profile")),
        ...definedEntry("comment", nodeAttr(node, "comment")),
        commands,
        enums,
    };
};

const collectInterfaceBlocks = (node: OrderedNode): GlInterfaceBlock[] => {
    const blocks: GlInterfaceBlock[] = [];

    for (const child of nodeChildren(node)) {
        const tag = nodeTag(child);

        if (tag === "require" || tag === "remove") {
            blocks.push(parseInterfaceBlock(child, tag));
        }
    }

    return blocks;
};

const parseFeature = (node: OrderedNode): GlFeature | undefined => {
    const api = nodeAttr(node, "api");
    const name = nodeAttr(node, NAME_TAG);
    const number = nodeAttr(node, "number");

    if (api === undefined || name === undefined || number === undefined) {
        return undefined;
    }

    return { api, name, number: Number(number), blocks: collectInterfaceBlocks(node) };
};

const parseExtension = (node: OrderedNode): GlExtension | undefined => {
    const name = nodeAttr(node, NAME_TAG);

    if (name === undefined || nodeTag(node) !== "extension") {
        return undefined;
    }

    return {
        name,
        supported: splitAttr(nodeAttr(node, "supported"), "|"),
        ...definedEntry("comment", nodeAttr(node, "comment")),
        blocks: collectInterfaceBlocks(node),
    };
};

const typeName = (node: OrderedNode): string => {
    const fromChild = elementName(node);

    if (fromChild.length > 0) {
        return fromChild;
    }

    return nodeAttr(node, NAME_TAG) ?? "";
};

const parseType = (node: OrderedNode): GlType | undefined => {
    const name = typeName(node);

    if (name.length === 0 || nodeTag(node) !== "type") {
        return undefined;
    }

    return {
        name,
        declaration: normalizeWhitespace(collectText(node, EMPTY_SKIP)),
        ...definedEntry("requires", nodeAttr(node, "requires")),
        ...definedEntry("comment", nodeAttr(node, "comment")),
    };
};

const addCommand = (child: OrderedNode, into: Map<string, GlCommand>): void => {
    if (nodeTag(child) !== "command") {
        return;
    }

    const command = parseCommand(child);

    if (command !== undefined && command.name.length > 0) {
        into.set(command.name, command);
    }
};

const parseCommandsSection = (section: OrderedNode, registry: GlRegistry): void => {
    for (const child of nodeChildren(section)) {
        addCommand(child, registry.commands);
    }
};

const parseTypesSection = (section: OrderedNode, registry: GlRegistry): void => {
    for (const child of nodeChildren(section)) {
        const parsed = parseType(child);

        if (parsed !== undefined) {
            registry.types.set(parsed.name, parsed);
        }
    }
};

const addKind = (child: OrderedNode, into: Map<string, string>): void => {
    const name = nodeAttr(child, NAME_TAG);
    const desc = nodeAttr(child, "desc");

    if (name !== undefined && desc !== undefined && nodeTag(child) === "kind") {
        into.set(name, desc);
    }
};

const parseKindsSection = (section: OrderedNode, registry: GlRegistry): void => {
    for (const child of nodeChildren(section)) {
        addKind(child, registry.kinds);
    }
};

const parseExtensionsSection = (section: OrderedNode, registry: GlRegistry): void => {
    for (const child of nodeChildren(section)) {
        const parsed = parseExtension(child);

        if (parsed !== undefined) {
            registry.extensions.push(parsed);
        }
    }
};

const parseFeatureSection = (section: OrderedNode, registry: GlRegistry): void => {
    const feature = parseFeature(section);

    if (feature !== undefined) {
        registry.features.push(feature);
    }
};

const parseCommentSection = (section: OrderedNode, registry: GlRegistry): void => {
    registry.comment = normalizeBlockText(collectText(section, EMPTY_SKIP));
};

const sectionHandlerFor = (tag: string): SectionHandler | undefined => {
    switch (tag) {
        case "comment": {
            return parseCommentSection;
        }
        case "commands": {
            return parseCommandsSection;
        }
        case "enums": {
            return parseEnums;
        }
        case "extensions": {
            return parseExtensionsSection;
        }
        case "feature": {
            return parseFeatureSection;
        }
        case "kinds": {
            return parseKindsSection;
        }
        case "types": {
            return parseTypesSection;
        }
        default: {
            return undefined;
        }
    }
};

const parseSection = (section: OrderedNode, registry: GlRegistry): void => {
    sectionHandlerFor(nodeTag(section))?.(section, registry);
};

const sortAliasNames = (pending: Map<string, string[]>): Map<string, string[]> => {
    const sorted: Map<string, string[]> = new Map();

    for (const target of sortStrings(pending.keys())) {
        sorted.set(target, sortStrings(pending.get(target) ?? []));
    }

    return sorted;
};

const buildAliasTargets = (commands: Map<string, GlCommand>): Map<string, string[]> => {
    const pending: Map<string, string[]> = new Map();

    for (const command of commands.values()) {
        const target = command.aliasTarget;

        if (target !== undefined) {
            pending.set(target, [...(pending.get(target) ?? []), command.name]);
        }
    }

    return sortAliasNames(pending);
};

const loadGlRegistry = (path: string): GlRegistry => {
    const registry: GlRegistry = {
        types: new Map<string, GlType>(),
        kinds: new Map<string, string>(),
        commands: new Map<string, GlCommand>(),
        enums: [],
        features: [],
        extensions: [],
        aliasTargets: new Map<string, string[]>(),
        bitmaskGroups: new Set<string>(),
    };

    for (const section of parseRegistryFile(path)) {
        parseSection(section, registry);
    }

    registry.aliasTargets = buildAliasTargets(registry.commands);

    return registry;
};

export {
    loadGlRegistry,
    type GlParam,
    type GlGlx,
    type GlCommand,
    type GlEnum,
    type GlInterfaceBlock,
    type GlFeature,
    type GlExtension,
    type GlType,
    type GlRegistry,
};
