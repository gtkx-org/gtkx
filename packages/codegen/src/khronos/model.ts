import { collectText, nodeAttr, nodeChildren, nodeTag, type OrderedNode, parseRegistryFile } from "./parse.js";

type GlParam = {
    name: string;
    cType: string;
    group?: string;
    len?: string;
    objectClass?: string;
};

type GlCommand = {
    name: string;
    returnCType: string;
    returnGroup?: string;
    params: GlParam[];
};

type GlEnum = {
    name: string;
    value: string;
    groups: string[];
};

type GlInterfaceBlock = {
    profile?: string;
    commands: string[];
    enums: string[];
};

type GlFeature = {
    api: string;
    name: string;
    number: number;
    requires: GlInterfaceBlock[];
    removes: GlInterfaceBlock[];
};

type GlRegistry = {
    commands: Map<string, GlCommand>;
    enums: GlEnum[];
    features: GlFeature[];
};

const NAME_TAG = "name";
const SKIP_IN_C_TYPE: Set<string> = new Set([NAME_TAG, "comment"]);

const normalizeWhitespace = (text: string): string => text.replaceAll(/\s+/g, " ").trim();

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

    return normalizeWhitespace(collectText(nameChild, new Set()));
};

const parseParam = (node: OrderedNode): GlParam => {
    const param: GlParam = {
        name: elementName(node),
        cType: normalizeWhitespace(collectText(node, SKIP_IN_C_TYPE)),
    };

    const group = nodeAttr(node, "group");
    const len = nodeAttr(node, "len");
    const objectClass = nodeAttr(node, "class");

    return {
        ...param,
        ...((group !== undefined) && { group }),
        ...((len !== undefined) && { len }),
        ...((objectClass !== undefined) && { objectClass }),
    };
};

const parseCommand = (node: OrderedNode): GlCommand | undefined => {
    const proto = childNamed(node, "proto");

    if (proto === undefined) {
        return undefined;
    }

    const params: GlParam[] = [];

    for (const child of nodeChildren(node)) {
        if (nodeTag(child) === "param") {
            params.push(parseParam(child));
        }
    }

    const returnGroup = nodeAttr(proto, "group");

    return {
        name: elementName(proto),
        returnCType: normalizeWhitespace(collectText(proto, SKIP_IN_C_TYPE)),
        ...((returnGroup !== undefined) && { returnGroup }),
        params,
    };
};

const parseEnum = (child: OrderedNode): GlEnum | undefined => {
    if (nodeTag(child) !== "enum") {
        return undefined;
    }

    const name = nodeAttr(child, "name");
    const value = nodeAttr(child, "value");

    if (name === undefined || value === undefined) {
        return undefined;
    }

    const group = nodeAttr(child, "group");

    return {
        name,
        value,
        groups: group === undefined ? [] : group.split(",").map((part) => part.trim()),
    };
};

const parseEnums = (node: OrderedNode, into: GlEnum[]): void => {
    for (const child of nodeChildren(node)) {
        const parsed = parseEnum(child);

        if (parsed !== undefined) {
            into.push(parsed);
        }
    }
};

const collectInterfaceMember = (child: OrderedNode, commands: string[], enums: string[]): void => {
    const name = nodeAttr(child, "name");

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

const parseInterfaceBlock = (node: OrderedNode): GlInterfaceBlock => {
    const commands: string[] = [];
    const enums: string[] = [];

    for (const child of nodeChildren(node)) {
        collectInterfaceMember(child, commands, enums);
    }

    const profile = nodeAttr(node, "profile");

    return {
        ...((profile !== undefined) && { profile }),
        commands,
        enums,
    };
};

const collectFeatureBlock = (child: OrderedNode, requires: GlInterfaceBlock[], removes: GlInterfaceBlock[]): void => {
    const tag = nodeTag(child);

    if (tag === "require") {
        requires.push(parseInterfaceBlock(child));
    } else if (tag === "remove") {
        removes.push(parseInterfaceBlock(child));
    }
};

const parseFeature = (node: OrderedNode): GlFeature | undefined => {
    const api = nodeAttr(node, "api");
    const name = nodeAttr(node, "name");
    const number = nodeAttr(node, "number");

    if (api === undefined || name === undefined || number === undefined) {
        return undefined;
    }

    const requires: GlInterfaceBlock[] = [];
    const removes: GlInterfaceBlock[] = [];

    for (const child of nodeChildren(node)) {
        collectFeatureBlock(child, requires, removes);
    }

    return { api, name, number: Number(number), requires, removes };
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

const parseCommandsSection = (section: OrderedNode, into: Map<string, GlCommand>): void => {
    for (const child of nodeChildren(section)) {
        addCommand(child, into);
    }
};

const parseSection = (section: OrderedNode, registry: GlRegistry): void => {
    const tag = nodeTag(section);

    if (tag === "commands") {
        parseCommandsSection(section, registry.commands);

        return;
    }

    if (tag === "enums") {
        parseEnums(section, registry.enums);

        return;
    }

    if (tag !== "feature") {
        return;
    }

    const feature = parseFeature(section);

    if (feature !== undefined) {
        registry.features.push(feature);
    }
};

const loadGlRegistry = (path: string): GlRegistry => {
    const registry: GlRegistry = { commands: new Map<string, GlCommand>(), enums: [], features: [] };

    for (const section of parseRegistryFile(path)) {
        parseSection(section, registry);
    }

    return registry;
};

export {
    loadGlRegistry,
    type GlParam,
    type GlCommand,
    type GlEnum,
    type GlInterfaceBlock,
    type GlFeature,
    type GlRegistry,
};
